package com.dormmate.backend.modules.auth.application;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.dormmate.backend.modules.auth.presentation.dto.LoginRequest;
import com.dormmate.backend.modules.auth.presentation.dto.LoginResponse;
import com.dormmate.backend.modules.auth.presentation.dto.LogoutRequest;
import com.dormmate.backend.modules.auth.presentation.dto.RefreshRequest;
import com.dormmate.backend.modules.auth.presentation.dto.TokenPairResponse;
import com.dormmate.backend.modules.auth.presentation.dto.RoomAssignmentResponse;
import com.dormmate.backend.modules.auth.presentation.dto.UserProfileResponse;
import com.dormmate.backend.modules.auth.domain.DormUser;
import com.dormmate.backend.modules.auth.domain.DormUserStatus;
import com.dormmate.backend.modules.auth.domain.RoomAssignment;
import com.dormmate.backend.modules.auth.domain.UserRole;
import com.dormmate.backend.modules.auth.domain.UserSession;
import com.dormmate.backend.modules.auth.infrastructure.DormUserRepository;
import com.dormmate.backend.modules.auth.infrastructure.RoomAssignmentRepository;
import com.dormmate.backend.modules.auth.infrastructure.UserRoleRepository;
import com.dormmate.backend.modules.auth.infrastructure.UserSessionRepository;

import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@Transactional
public class AuthService {

    private final DormUserRepository dormUserRepository;
    private final UserRoleRepository userRoleRepository;
    private final RoomAssignmentRepository roomAssignmentRepository;
    private final UserSessionRepository userSessionRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenService jwtTokenService;

    public AuthService(
            DormUserRepository dormUserRepository,
            UserRoleRepository userRoleRepository,
            RoomAssignmentRepository roomAssignmentRepository,
            UserSessionRepository userSessionRepository,
            PasswordEncoder passwordEncoder,
            JwtTokenService jwtTokenService
    ) {
        this.dormUserRepository = dormUserRepository;
        this.userRoleRepository = userRoleRepository;
        this.roomAssignmentRepository = roomAssignmentRepository;
        this.userSessionRepository = userSessionRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtTokenService = jwtTokenService;
    }

    public LoginResponse login(LoginRequest request) {
        DormUser user = dormUserRepository.findByLoginIdIgnoreCase(request.loginId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "INVALID_CREDENTIALS"));

        if (user.getStatus() != DormUserStatus.ACTIVE) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "USER_INACTIVE");
        }

        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "INVALID_CREDENTIALS");
        }

        List<String> roleCodes = extractActiveRoleCodes(user.getId());
        String refreshToken = UUID.randomUUID().toString();

        TokenPairResponse tokens = jwtTokenService.issueTokenPair(user.getId(), user.getLoginId(), roleCodes, refreshToken);
        persistSession(user, refreshToken, tokens);

        UserProfileResponse profile = buildUserProfile(user, roleCodes);
        return new LoginResponse(tokens, profile);
    }

    public LoginResponse refresh(RefreshRequest request) {
        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
        UserSession session = userSessionRepository.findActiveByRefreshToken(request.refreshToken())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "INVALID_REFRESH_TOKEN"));

        if (session.getRevokedAt() != null || session.getExpiresAt().isBefore(now)) {
            revokeSession(session, "EXPIRED");
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "REFRESH_TOKEN_EXPIRED");
        }

        DormUser user = session.getDormUser();
        if (user.getStatus() != DormUserStatus.ACTIVE) {
            revokeSession(session, "USER_INACTIVE");
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "USER_INACTIVE");
        }

        // 재사용 방지: 기존 세션은 즉시 폐기하고 새 토큰을 발급한다.
        revokeSession(session, "ROTATED");

        List<String> roleCodes = extractActiveRoleCodes(user.getId());
        String refreshToken = UUID.randomUUID().toString();

        TokenPairResponse tokens = jwtTokenService.issueTokenPair(user.getId(), user.getLoginId(), roleCodes, refreshToken);
        persistSession(user, refreshToken, tokens);

        UserProfileResponse profile = buildUserProfile(user, roleCodes);
        return new LoginResponse(tokens, profile);
    }

    public void logout(LogoutRequest request) {
        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
        int updated = userSessionRepository.revokeByRefreshToken(request.refreshToken(), now, "LOGOUT");
        if (updated == 0) {
            // 기등록되지 않은 토큰도 동일한 응답을 반환해 토큰 유효 여부가 노출되지 않도록 한다.
            return;
        }
    }

    @Transactional(readOnly = true)
    public UserProfileResponse loadProfile(UUID userId) {
        DormUser user = dormUserRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "USER_NOT_FOUND"));
        List<String> roleCodes = extractActiveRoleCodes(user.getId());
        return buildUserProfile(user, roleCodes);
    }

    private void persistSession(DormUser user, String refreshToken, TokenPairResponse tokens) {
        OffsetDateTime issuedAt = tokens.issuedAt();
        OffsetDateTime refreshExpiry = issuedAt.plusSeconds(tokens.refreshExpiresIn());

        UserSession session = new UserSession();
        session.setDormUser(user);
        session.setRefreshToken(refreshToken);
        session.setIssuedAt(issuedAt);
        session.setExpiresAt(refreshExpiry);

        userSessionRepository.save(session);
    }

    private void revokeSession(UserSession session, String reason) {
        session.setRevokedAt(OffsetDateTime.now(ZoneOffset.UTC));
        session.setRevokedReason(reason);
        userSessionRepository.save(session);
    }

    private List<String> extractActiveRoleCodes(UUID userId) {
        return userRoleRepository.findActiveRoles(userId).stream()
                .map(UserRole::getRole)
                .map(role -> role.getCode())
                .distinct()
                .toList();
    }

    private UserProfileResponse buildUserProfile(DormUser user, List<String> roleCodes) {
        Optional<RoomAssignment> activeAssignment = roomAssignmentRepository.findActiveAssignment(user.getId());

        RoomAssignmentResponse roomResponse = activeAssignment
                .map(assignment -> new RoomAssignmentResponse(
                        assignment.getRoom().getId(),
                        assignment.getRoom().getFloor(),
                        assignment.getRoom().getRoomNumber(),
                        assignment.getPersonalNo(),
                        assignment.getAssignedAt(),
                        assignment.getRoom().getFloor() + "F"
                ))
                .orElse(null);

        boolean isFloorManager = roleCodes.contains("FLOOR_MANAGER");
        boolean isAdmin = roleCodes.contains("ADMIN");

        return new UserProfileResponse(
                user.getId(),
                user.getLoginId(),
                user.getFullName(),
                user.getEmail(),
                roleCodes,
                roomResponse,
                isFloorManager,
                isAdmin,
                user.getCreatedAt(),
                user.getUpdatedAt()
        );
    }
}

package com.dormmate.backend.modules.admin.application;

import java.time.Clock;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.lang.NonNull;

import com.dormmate.backend.global.error.ProblemException;
import com.dormmate.backend.modules.admin.domain.AdminPolicy;
import com.dormmate.backend.modules.admin.infrastructure.AdminPolicyRepository;
import com.dormmate.backend.modules.auth.domain.DormUser;
import com.dormmate.backend.modules.auth.domain.DormUserStatus;
import com.dormmate.backend.modules.auth.domain.Role;
import com.dormmate.backend.modules.auth.domain.UserRole;
import com.dormmate.backend.modules.auth.infrastructure.persistence.DormUserRepository;
import com.dormmate.backend.modules.auth.infrastructure.persistence.RoleRepository;
import com.dormmate.backend.modules.auth.infrastructure.persistence.UserRoleRepository;
import com.dormmate.backend.modules.auth.infrastructure.persistence.UserSessionRepository;
import com.dormmate.backend.modules.inspection.domain.InspectionStatus;
import com.dormmate.backend.modules.inspection.infrastructure.persistence.InspectionSessionRepository;

@Service
@Transactional
public class AdminMutationService {

    private static final UUID POLICY_ID = UUID.fromString("00000000-0000-0000-0000-000000000001");

    private final DormUserRepository dormUserRepository;
    private final RoleRepository roleRepository;
    private final UserRoleRepository userRoleRepository;
    private final UserSessionRepository userSessionRepository;
    private final InspectionSessionRepository inspectionSessionRepository;
    private final AdminPolicyRepository adminPolicyRepository;
    private final Clock clock;

    public AdminMutationService(
            DormUserRepository dormUserRepository,
            RoleRepository roleRepository,
            UserRoleRepository userRoleRepository,
            UserSessionRepository userSessionRepository,
            InspectionSessionRepository inspectionSessionRepository,
            AdminPolicyRepository adminPolicyRepository,
            Clock clock
    ) {
        this.dormUserRepository = dormUserRepository;
        this.roleRepository = roleRepository;
        this.userRoleRepository = userRoleRepository;
        this.userSessionRepository = userSessionRepository;
        this.inspectionSessionRepository = inspectionSessionRepository;
        this.adminPolicyRepository = adminPolicyRepository;
        this.clock = clock;
    }

    public void promoteToFloorManager(@NonNull UUID targetUserId, @NonNull UUID actorUserId) {
        DormUser target = findUser(targetUserId);
        DormUser actor = findUser(actorUserId);
        ensureUserIsActive(target);

        boolean alreadyAssigned = userRoleRepository.findActiveRoles(targetUserId).stream()
                .anyMatch(role -> "FLOOR_MANAGER".equalsIgnoreCase(role.getRole().getCode()));
        if (alreadyAssigned) {
            throw new ProblemException(HttpStatus.CONFLICT, "admin.role_already_assigned", "이미 층별장 권한이 부여된 사용자입니다.");
        }

        Role floorManagerRole = roleRepository.findById("FLOOR_MANAGER")
                .orElseThrow(() -> new ProblemException(HttpStatus.INTERNAL_SERVER_ERROR, "admin.role_missing", "층별장 역할이 정의되어 있지 않습니다."));

        UserRole userRole = new UserRole();
        userRole.setDormUser(target);
        userRole.setRole(floorManagerRole);
        userRole.setGrantedAt(OffsetDateTime.now(clock));
        userRole.setGrantedBy(actor);
        userRoleRepository.save(userRole);
    }

    public void demoteFloorManager(@NonNull UUID targetUserId) {
        findUser(targetUserId);
        ensureNoActiveInspection(targetUserId);

        List<UserRole> activeRoles = userRoleRepository.findActiveRoles(targetUserId);
        UserRole floorManagerRole = activeRoles.stream()
                .filter(role -> "FLOOR_MANAGER".equalsIgnoreCase(role.getRole().getCode()))
                .findFirst()
                .orElseThrow(() -> new ProblemException(HttpStatus.NOT_FOUND, "admin.role_not_found", "층별장 권한이 부여되어 있지 않습니다."));

        floorManagerRole.setRevokedAt(OffsetDateTime.now(clock));
        userRoleRepository.save(floorManagerRole);
    }

    public void deactivateUser(@NonNull UUID targetUserId) {
        DormUser target = findUser(targetUserId);
        if (target.getStatus() == DormUserStatus.INACTIVE) {
            return;
        }

        ensureNoActiveInspection(targetUserId);

        OffsetDateTime now = OffsetDateTime.now(clock);
        target.setStatus(DormUserStatus.INACTIVE);
        target.setDeactivatedAt(now);

        userRoleRepository.findActiveRoles(targetUserId).forEach(role -> {
            role.setRevokedAt(now);
            userRoleRepository.save(role);
        });

        userSessionRepository.findActiveSessionsByUserIds(Set.of(targetUserId), now).forEach(session -> {
            session.setRevokedAt(now);
            session.setRevokedReason("ACCOUNT_DEACTIVATED");
        });
    }

    public void updatePolicies(@NonNull UpdatePoliciesCommand command) {
        validatePolicyValues(command);

        AdminPolicy policy = adminPolicyRepository.findById(POLICY_ID)
                .orElseGet(() -> {
                    AdminPolicy created = new AdminPolicy();
                    created.setId(POLICY_ID);
                    return created;
                });

        policy.setNotificationBatchTime(command.notificationBatchTime());
        policy.setNotificationDailyLimit(command.notificationDailyLimit());
        policy.setNotificationTtlHours(command.notificationTtlHours());
        policy.setPenaltyLimit(command.penaltyLimit());
        policy.setPenaltyTemplate(command.penaltyTemplate());

        adminPolicyRepository.save(policy);
    }

    private DormUser findUser(@NonNull UUID userId) {
        return dormUserRepository.findById(userId)
                .orElseThrow(() -> new ProblemException(HttpStatus.NOT_FOUND, "admin.user_not_found", "대상 사용자를 찾을 수 없습니다."));
    }

    private void ensureUserIsActive(DormUser user) {
        if (user.getStatus() != DormUserStatus.ACTIVE) {
            throw new ProblemException(HttpStatus.CONFLICT, "admin.user_inactive", "비활성 사용자에게는 권한을 부여할 수 없습니다.");
        }
    }

    private void ensureNoActiveInspection(UUID userId) {
        boolean hasActive = !inspectionSessionRepository
                .findActiveSessionsByUsers(InspectionStatus.IN_PROGRESS, Set.of(userId))
                .isEmpty();
        if (hasActive) {
            throw new ProblemException(HttpStatus.CONFLICT, "admin.active_inspection_exists", "진행 중인 검사 세션이 있어 작업을 완료할 수 없습니다.");
        }
    }

    private void validatePolicyValues(UpdatePoliciesCommand command) {
        if (command.notificationDailyLimit() < 0) {
            throw new ProblemException(HttpStatus.BAD_REQUEST, "admin.invalid_notification_limit", "알림 상한은 0 이상이어야 합니다.");
        }
        if (command.notificationTtlHours() <= 0) {
            throw new ProblemException(HttpStatus.BAD_REQUEST, "admin.invalid_notification_ttl", "알림 TTL은 1시간 이상이어야 합니다.");
        }
        if (command.penaltyLimit() < 0) {
            throw new ProblemException(HttpStatus.BAD_REQUEST, "admin.invalid_penalty_limit", "벌점 임계치는 0 이상이어야 합니다.");
        }
        if (command.penaltyTemplate() == null || command.penaltyTemplate().isBlank()) {
            throw new ProblemException(HttpStatus.BAD_REQUEST, "admin.invalid_penalty_template", "벌점 알림 템플릿을 입력해야 합니다.");
        }
        LocalTime batchTime = command.notificationBatchTime();
        if (batchTime == null) {
            throw new ProblemException(HttpStatus.BAD_REQUEST, "admin.invalid_batch_time", "배치 시각이 올바르지 않습니다.");
        }
    }

    public record UpdatePoliciesCommand(
            LocalTime notificationBatchTime,
            int notificationDailyLimit,
            int notificationTtlHours,
            int penaltyLimit,
            String penaltyTemplate
    ) {
    }
}

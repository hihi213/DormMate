package com.dormmate.backend.modules.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.time.OffsetDateTime;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;

import com.dormmate.backend.modules.auth.domain.DormUser;
import com.dormmate.backend.modules.auth.domain.UserSession;
import com.dormmate.backend.modules.auth.presentation.dto.LoginRequest;
import com.dormmate.backend.modules.auth.presentation.dto.RefreshRequest;
import com.dormmate.backend.modules.auth.application.AuthService;
import com.dormmate.backend.modules.auth.infrastructure.persistence.DormUserRepository;
import com.dormmate.backend.modules.auth.infrastructure.persistence.UserSessionRepository;
import com.dormmate.backend.support.AbstractPostgresIntegrationTest;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.web.server.ResponseStatusException;

@SpringBootTest
class AuthServiceTest extends AbstractPostgresIntegrationTest {

    @Autowired
    AuthService authService;

    @Autowired
    DormUserRepository dormUserRepository;

    @Autowired
    UserSessionRepository userSessionRepository;

    @Test
    void loginSucceedsWithSeedAdmin() {
        var response = authService.login(new LoginRequest("dormmate", "admin1!", null));
        assertThat(response.user().loginId()).isEqualTo("dormmate");
    }

    @Test
    void loginStoresDeviceIdAndRevokesExpiredSessions() {
        DormUser admin = dormUserRepository.findByLoginIdIgnoreCase("dormmate").orElseThrow();

        UserSession expired = new UserSession();
        expired.setDormUser(admin);
        expired.setRefreshTokenHash(hashToken("expired-token"));
        OffsetDateTime issuedAt = OffsetDateTime.now().minusDays(10);
        expired.setIssuedAt(issuedAt);
        expired.setExpiresAt(issuedAt.plusDays(1));
        expired.setDeviceId("legacy-device");
        userSessionRepository.save(expired);

        var response = authService.login(new LoginRequest("dormmate", "admin1!", "  ios-device-1234567890   "));

        UserSession freshSession = userSessionRepository.findByRefreshTokenHash(hashToken(response.tokens().refreshToken())).orElseThrow();
        assertThat(freshSession.getDeviceId()).isEqualTo("ios-device-1234567890");
        assertThat(freshSession.getRevokedAt()).isNull();
        assertThat(freshSession.getExpiresAt()).isAfter(freshSession.getIssuedAt().plusDays(6));
        assertThat(freshSession.getExpiresAt()).isBefore(freshSession.getIssuedAt().plusDays(8));

        UserSession revoked = userSessionRepository.findByRefreshTokenHash(hashToken("expired-token")).orElseThrow();
        assertThat(revoked.getRevokedAt()).isNotNull();
        assertThat(revoked.getRevokedReason()).isEqualTo("EXPIRED");
    }

    @Test
    void refreshFailsWhenDeviceChanges() {
        var login = authService.login(new LoginRequest("dormmate", "admin1!", "web-browser"));
        String refreshToken = login.tokens().refreshToken();

        ResponseStatusException exception = assertThrows(
                ResponseStatusException.class,
                () -> authService.refresh(new RefreshRequest(refreshToken, "mobile-app"))
        );
        assertThat(exception.getReason()).isEqualTo("REFRESH_TOKEN_DEVICE_MISMATCH");

        UserSession revoked = userSessionRepository.findByRefreshTokenHash(hashToken(refreshToken)).orElseThrow();
        assertThat(revoked.getRevokedReason()).isEqualTo("DEVICE_MISMATCH");
        assertThat(revoked.getRevokedAt()).isNotNull();
    }

    private String hashToken(String token) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hashed = digest.digest(token.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hashed);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("Failed to hash token in test", e);
        }
    }
}

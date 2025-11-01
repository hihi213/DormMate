package com.dormmate.backend.modules.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.time.OffsetDateTime;

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
        var response = authService.login(new LoginRequest("admin", "password", null));
        assertThat(response.user().loginId()).isEqualTo("admin");
    }

    @Test
    void loginStoresDeviceIdAndRevokesExpiredSessions() {
        DormUser admin = dormUserRepository.findByLoginIdIgnoreCase("admin").orElseThrow();

        UserSession expired = new UserSession();
        expired.setDormUser(admin);
        expired.setRefreshToken("expired-token");
        OffsetDateTime issuedAt = OffsetDateTime.now().minusDays(10);
        expired.setIssuedAt(issuedAt);
        expired.setExpiresAt(issuedAt.plusDays(1));
        expired.setDeviceId("legacy-device");
        userSessionRepository.save(expired);

        var response = authService.login(new LoginRequest("admin", "password", "  ios-device-1234567890   "));

        UserSession freshSession = userSessionRepository.findByRefreshToken(response.tokens().refreshToken()).orElseThrow();
        assertThat(freshSession.getDeviceId()).isEqualTo("ios-device-1234567890");
        assertThat(freshSession.getRevokedAt()).isNull();
        assertThat(freshSession.getExpiresAt()).isAfter(freshSession.getIssuedAt().plusDays(6));
        assertThat(freshSession.getExpiresAt()).isBefore(freshSession.getIssuedAt().plusDays(8));

        UserSession revoked = userSessionRepository.findByRefreshToken("expired-token").orElseThrow();
        assertThat(revoked.getRevokedAt()).isNotNull();
        assertThat(revoked.getRevokedReason()).isEqualTo("EXPIRED");
    }

    @Test
    void refreshFailsWhenDeviceChanges() {
        var login = authService.login(new LoginRequest("admin", "password", "web-browser"));
        String refreshToken = login.tokens().refreshToken();

        ResponseStatusException exception = assertThrows(
                ResponseStatusException.class,
                () -> authService.refresh(new RefreshRequest(refreshToken, "mobile-app"))
        );
        assertThat(exception.getReason()).isEqualTo("REFRESH_TOKEN_DEVICE_MISMATCH");

        UserSession revoked = userSessionRepository.findByRefreshToken(refreshToken).orElseThrow();
        assertThat(revoked.getRevokedReason()).isEqualTo("DEVICE_MISMATCH");
        assertThat(revoked.getRevokedAt()).isNotNull();
    }
}

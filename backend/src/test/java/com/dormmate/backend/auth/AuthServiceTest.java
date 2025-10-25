package com.dormmate.backend.auth;

import static org.assertj.core.api.Assertions.assertThat;

import com.dormmate.backend.dto.auth.LoginRequest;
import com.dormmate.backend.service.AuthService;
import com.dormmate.backend.support.AbstractPostgresIntegrationTest;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest
class AuthServiceTest extends AbstractPostgresIntegrationTest {

    @Autowired
    AuthService authService;

    @Test
    void loginSucceedsWithSeedAdmin() {
        var response = authService.login(new LoginRequest("admin", "password", null));
        assertThat(response.user().loginId()).isEqualTo("admin");
    }
}

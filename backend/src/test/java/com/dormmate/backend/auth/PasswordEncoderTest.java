package com.dormmate.backend.auth;

import static org.assertj.core.api.Assertions.assertThat;

import com.dormmate.backend.repository.DormUserRepository;
import com.dormmate.backend.support.AbstractPostgresIntegrationTest;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.crypto.password.PasswordEncoder;

@SpringBootTest
class PasswordEncoderTest extends AbstractPostgresIntegrationTest {

    @Autowired
    PasswordEncoder passwordEncoder;

    @Autowired
    DormUserRepository dormUserRepository;

    @Test
    void matchesSeedHash() {
        String hash = dormUserRepository.findByLoginIdIgnoreCase("admin")
                .orElseThrow()
                .getPasswordHash();
        assertThat(passwordEncoder.matches("password", hash)).isTrue();
    }
}

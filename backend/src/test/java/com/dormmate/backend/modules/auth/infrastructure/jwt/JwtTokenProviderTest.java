package com.dormmate.backend.modules.auth.infrastructure.jwt;

import java.util.Base64;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;

class JwtTokenProviderTest {
    @Test void rejectsWeakKeysAtConstruction() {
        assertThatThrownBy(() -> new JwtTokenProvider("?")).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new JwtTokenProvider(Base64.getEncoder().encodeToString(new byte[16])))
                .isInstanceOf(IllegalArgumentException.class);
        assertThat(new JwtTokenProvider(Base64.getEncoder().encodeToString(new byte[32]))
                .getSecretKey().getEncoded()).hasSize(32);
    }
}

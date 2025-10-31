package com.dormmate.backend.modules.auth.infrastructure.jwt;

import java.nio.charset.StandardCharsets;
import java.util.Base64;

import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * JWT 토큰 생성을 위한 시크릿 키 래퍼.
 */
@Component
public class JwtTokenProvider {

    private static final String HMAC_SHA_256 = "HmacSHA256";

    private final SecretKey secretKey;

    public JwtTokenProvider(@Value("${jwt.secret}") String secretString) {
        byte[] keyBytes;
        try {
            keyBytes = Base64.getDecoder().decode(secretString);
        } catch (IllegalArgumentException ex) {
            keyBytes = secretString.getBytes(StandardCharsets.UTF_8);
        }
        this.secretKey = new SecretKeySpec(keyBytes, HMAC_SHA_256);
    }

    public SecretKey getSecretKey() {
        return secretKey;
    }
}

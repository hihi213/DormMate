package com.dormmate.backend.auth;

import java.security.Key;
import java.util.Base64;
import javax.crypto.spec.SecretKeySpec;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * JWT 토큰 생성을 위한 시크릿 키 래퍼.
 */
@Component
public class JwtTokenProvider {

    private static final String HMAC_SHA_256 = "HmacSHA256";

    private final Key secretKey;

    public JwtTokenProvider(@Value("${jwt.secret}") String secretString) {
        byte[] keyBytes = Base64.getDecoder().decode(secretString);
        this.secretKey = new SecretKeySpec(keyBytes, HMAC_SHA_256);
    }

    public Key getSecretKey() {
        return secretKey;
    }
}

package com.dormmate.backend.modules.auth.application;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Date;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

import com.dormmate.backend.modules.auth.infrastructure.jwt.JwtTokenProvider;
import com.dormmate.backend.modules.auth.presentation.dto.TokenPairResponse;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import javax.crypto.SecretKey;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class JwtTokenService {

    private final JwtTokenProvider tokenProvider;
    private final long accessTokenTtlMillis;
    private final long refreshTokenTtlMillis;

    public JwtTokenService(
            JwtTokenProvider tokenProvider,
            @Value("${jwt.expiration:900000}") long accessTokenTtlMillis,
            @Value("${jwt.refresh-expiration:604800000}") long refreshTokenTtlMillis
    ) {
        this.tokenProvider = tokenProvider;
        this.accessTokenTtlMillis = accessTokenTtlMillis;
        this.refreshTokenTtlMillis = refreshTokenTtlMillis;
    }

    public TokenPairResponse issueTokenPair(UUID userId, String loginId, List<String> roles, String refreshToken) {
        Instant now = Instant.now();
        OffsetDateTime issuedAt = OffsetDateTime.ofInstant(now, ZoneOffset.UTC);
        Instant accessExpiry = now.plusMillis(accessTokenTtlMillis);
        Instant refreshExpiry = now.plusMillis(refreshTokenTtlMillis);

        SecretKey key = tokenProvider.getSecretKey();

        String accessToken = Jwts.builder()
                .setSubject(userId.toString())
                .setIssuedAt(Date.from(now))
                .setExpiration(Date.from(accessExpiry))
                .claim("loginId", loginId)
                .claim("roles", roles)
                .signWith(key, SignatureAlgorithm.HS256)
                .compact();

        long accessExpiresInSeconds = accessTokenTtlMillis / 1000L;
        long refreshExpiresInSeconds = refreshTokenTtlMillis / 1000L;

        return new TokenPairResponse(
                accessToken,
                TokenPairResponse.DEFAULT_TOKEN_TYPE,
                accessExpiresInSeconds,
                refreshToken,
                refreshExpiresInSeconds,
                issuedAt
        );
    }

    public ParsedToken parseAccessToken(String token) {
        try {
            Claims claims = Jwts.parser()
                    .verifyWith(tokenProvider.getSecretKey())
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();

            UUID userId = UUID.fromString(claims.getSubject());
            String loginId = claims.get("loginId", String.class);
            List<?> rolesClaim = claims.get("roles", List.class);
            List<String> roles = rolesClaim == null ? List.of() : rolesClaim.stream()
                    .filter(Objects::nonNull)
                    .map(Object::toString)
                    .toList();
            Instant issuedAt = claims.getIssuedAt() != null ? claims.getIssuedAt().toInstant() : Instant.now();
            Instant expiresAt = claims.getExpiration() != null ? claims.getExpiration().toInstant() : issuedAt;

            return new ParsedToken(
                    userId,
                    loginId,
                    roles,
                    OffsetDateTime.ofInstant(issuedAt, ZoneOffset.UTC),
                    OffsetDateTime.ofInstant(expiresAt, ZoneOffset.UTC)
            );
        } catch (JwtException | IllegalArgumentException e) {
            throw new InvalidTokenException("Invalid access token", e);
        }
    }

    public long getAccessTokenTtlMillis() {
        return accessTokenTtlMillis;
    }

    public long getRefreshTokenTtlMillis() {
        return refreshTokenTtlMillis;
    }

    public record ParsedToken(UUID userId, String loginId, List<String> roles, OffsetDateTime issuedAt, OffsetDateTime expiresAt) {
    }

    public static class InvalidTokenException extends RuntimeException {
        public InvalidTokenException(String message, Throwable cause) {
            super(message, cause);
        }
    }
}

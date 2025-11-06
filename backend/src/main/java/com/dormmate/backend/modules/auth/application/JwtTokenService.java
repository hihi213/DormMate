package com.dormmate.backend.modules.auth.application;

import java.time.Clock;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.Date;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

import com.dormmate.backend.modules.auth.infrastructure.jwt.JwtTokenProvider;
import com.dormmate.backend.modules.auth.presentation.dto.TokenPairResponse;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.Jwts.SIG;
import javax.crypto.SecretKey;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class JwtTokenService {

    private final JwtTokenProvider tokenProvider;
    private final long accessTokenTtlMillis;
    private final long refreshTokenTtlMillis;
    private final Clock clock;

    public JwtTokenService(
            JwtTokenProvider tokenProvider,
            @Value("${jwt.expiration:900000}") long accessTokenTtlMillis,
            @Value("${jwt.refresh-expiration:604800000}") long refreshTokenTtlMillis,
            Clock clock
    ) {
        this.tokenProvider = tokenProvider;
        this.accessTokenTtlMillis = accessTokenTtlMillis;
        this.refreshTokenTtlMillis = refreshTokenTtlMillis;
        this.clock = clock;
    }

    public TokenPairResponse issueTokenPair(UUID userId, String loginId, List<String> roles, String refreshToken) {
        Instant now = clock.instant();
        OffsetDateTime issuedAt = OffsetDateTime.ofInstant(now, clock.getZone());
        Instant accessExpiry = now.plusMillis(accessTokenTtlMillis);

        SecretKey key = tokenProvider.getSecretKey();

        String accessToken = Jwts.builder()
                .subject(userId.toString())
                .issuedAt(Date.from(now))
                .expiration(Date.from(accessExpiry))
                .claim("loginId", loginId)
                .claim("roles", roles)
                .signWith(key, SIG.HS256)
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
            Instant issuedAt = claims.getIssuedAt() != null ? claims.getIssuedAt().toInstant() : clock.instant();
            Instant expiresAt = claims.getExpiration() != null ? claims.getExpiration().toInstant() : issuedAt;

            return new ParsedToken(
                    userId,
                    loginId,
                    roles,
                    OffsetDateTime.ofInstant(issuedAt, clock.getZone()),
                    OffsetDateTime.ofInstant(expiresAt, clock.getZone())
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

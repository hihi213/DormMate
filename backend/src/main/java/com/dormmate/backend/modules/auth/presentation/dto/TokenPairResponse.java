package com.dormmate.backend.modules.auth.presentation.dto;

import java.time.OffsetDateTime;

public record TokenPairResponse(
        String accessToken,
        String tokenType,
        long expiresIn,
        String refreshToken,
        long refreshExpiresIn,
        OffsetDateTime issuedAt
) {
    public static final String DEFAULT_TOKEN_TYPE = "Bearer";
}

package com.dormmate.backend.modules.inspection.presentation.dto;

import java.time.OffsetDateTime;
import java.util.UUID;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record PenaltyHistoryResponse(
        UUID id,
        int points,
        String reason,
        OffsetDateTime issuedAt,
        OffsetDateTime expiresAt,
        UUID correlationId
) {
}

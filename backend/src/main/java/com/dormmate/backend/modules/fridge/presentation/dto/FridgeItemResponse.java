package com.dormmate.backend.modules.fridge.presentation.dto;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record FridgeItemResponse(
        UUID itemId,
        UUID bundleId,
        int sequenceNo,
        String name,
        LocalDate expiryDate,
        Integer quantity,
        String unit,
        String status,
        String priority,
        String memo,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt,
        OffsetDateTime removedAt
) {
}

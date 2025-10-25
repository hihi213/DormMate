package com.dormmate.backend.modules.fridge.presentation.dto;

import java.time.LocalDate;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;

public record UpdateItemRequest(
        @Size(min = 1, max = 120) String name,
        LocalDate expiryDate,
        @Min(1) Integer quantity,
        String priority,
        String memo,
        java.time.OffsetDateTime removedAt
) {
}

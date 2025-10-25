package com.dormmate.backend.modules.fridge.presentation.dto;

import java.time.LocalDate;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record AddItemRequest(
        @NotBlank String name,
        @NotNull LocalDate expiryDate,
        @Min(1) Integer quantity,
        String priority,
        String memo
) {
}

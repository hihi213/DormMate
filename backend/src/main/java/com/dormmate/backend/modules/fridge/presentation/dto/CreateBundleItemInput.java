package com.dormmate.backend.modules.fridge.presentation.dto;

import java.time.LocalDate;

import com.fasterxml.jackson.annotation.JsonInclude;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record CreateBundleItemInput(
        @NotBlank @Size(max = 120) String name,
        @NotNull LocalDate expiryDate,
        @Min(1) Integer quantity,
        String unitCode
) {
}

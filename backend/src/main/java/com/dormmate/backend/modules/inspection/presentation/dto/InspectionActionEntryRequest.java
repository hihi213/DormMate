package com.dormmate.backend.modules.inspection.presentation.dto;

import java.util.UUID;

import com.fasterxml.jackson.annotation.JsonInclude;

import jakarta.validation.constraints.NotBlank;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record InspectionActionEntryRequest(
        UUID bundleId,
        UUID itemId,
        @NotBlank String action,
        String note
) {
}

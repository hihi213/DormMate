package com.dormmate.backend.modules.fridge.presentation.dto;

import jakarta.validation.constraints.Min;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record UpdateCompartmentConfigRequest(
        @Min(value = 1, message = "maxBundleCount must be at least 1")
        Integer maxBundleCount,
        String status
) {
}

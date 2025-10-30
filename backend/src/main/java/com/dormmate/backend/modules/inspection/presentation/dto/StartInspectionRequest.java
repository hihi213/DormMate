package com.dormmate.backend.modules.inspection.presentation.dto;

import java.util.UUID;

import com.fasterxml.jackson.annotation.JsonInclude;

import jakarta.validation.constraints.NotNull;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record StartInspectionRequest(
        @NotNull UUID slotId
) {
}

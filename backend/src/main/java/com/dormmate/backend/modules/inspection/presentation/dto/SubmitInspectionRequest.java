package com.dormmate.backend.modules.inspection.presentation.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record SubmitInspectionRequest(String notes) {
}

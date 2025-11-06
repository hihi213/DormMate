package com.dormmate.backend.modules.inspection.presentation.dto;

import java.util.List;

import com.fasterxml.jackson.annotation.JsonInclude;

import jakarta.validation.Valid;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record UpdateInspectionSessionRequest(
        String notes,
        List<@Valid InspectionActionMutationRequest> mutations,
        List<Long> deleteActionIds
) {
}

package com.dormmate.backend.modules.inspection.presentation.dto;

import java.util.List;

import com.fasterxml.jackson.annotation.JsonInclude;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record InspectionActionRequest(
        @NotEmpty List<@Valid InspectionActionEntryRequest> actions
) {
}

package com.dormmate.backend.modules.inspection.presentation.dto;

import java.time.OffsetDateTime;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record ReinspectRequest(
        OffsetDateTime scheduledAt,
        String title,
        String notes
) {
}

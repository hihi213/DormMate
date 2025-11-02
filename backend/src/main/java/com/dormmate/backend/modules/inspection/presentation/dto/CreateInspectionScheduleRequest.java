package com.dormmate.backend.modules.inspection.presentation.dto;

import java.time.OffsetDateTime;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.UUID;

public record CreateInspectionScheduleRequest(
        @NotNull(message = "SCHEDULED_AT_REQUIRED")
        OffsetDateTime scheduledAt,
        @Size(max = 120, message = "TITLE_TOO_LONG")
        String title,
        String notes,
        @NotNull(message = "COMPARTMENT_REQUIRED")
        UUID fridgeCompartmentId
) {
}

package com.dormmate.backend.modules.inspection.presentation.dto;

import java.time.OffsetDateTime;
import java.util.UUID;

import jakarta.validation.constraints.Size;

public record UpdateInspectionScheduleRequest(
        OffsetDateTime scheduledAt,
        @Size(max = 120, message = "TITLE_TOO_LONG")
        String title,
        String notes,
        String status,
        OffsetDateTime completedAt,
        UUID inspectionSessionId,
        boolean detachInspectionSession
) {
}

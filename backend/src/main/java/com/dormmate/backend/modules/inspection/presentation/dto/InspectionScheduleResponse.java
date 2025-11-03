package com.dormmate.backend.modules.inspection.presentation.dto;

import java.time.OffsetDateTime;
import java.util.UUID;

public record InspectionScheduleResponse(
        UUID scheduleId,
        OffsetDateTime scheduledAt,
        String title,
        String notes,
        String status,
        OffsetDateTime completedAt,
        UUID inspectionSessionId,
        UUID fridgeCompartmentId,
        Integer slotIndex,
        String slotLetter,
        Integer floorNo,
        String floorCode,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt
) {
}

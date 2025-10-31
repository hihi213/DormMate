package com.dormmate.backend.modules.auth.presentation.dto;

import java.time.OffsetDateTime;
import java.util.UUID;

public record RoomAssignmentResponse(
        UUID roomId,
        short floor,
        String roomNumber,
        short personalNo,
        OffsetDateTime assignedAt,
        String floorCode
) {
}

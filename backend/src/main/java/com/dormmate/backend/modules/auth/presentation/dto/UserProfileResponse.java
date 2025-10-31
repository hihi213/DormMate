package com.dormmate.backend.modules.auth.presentation.dto;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public record UserProfileResponse(
        UUID userId,
        String loginId,
        String displayName,
        String email,
        List<String> roles,
        RoomAssignmentResponse primaryRoom,
        boolean isFloorManager,
        boolean isAdmin,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt
) {
}

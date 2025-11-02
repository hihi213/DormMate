package com.dormmate.backend.modules.fridge.presentation.dto.admin;

import java.time.OffsetDateTime;

public record ReallocationApplyResponse(
        short floor,
        int affectedCompartments,
        int releasedAssignments,
        int createdAssignments,
        OffsetDateTime appliedAt
) {
}

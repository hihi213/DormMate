package com.dormmate.backend.modules.admin.presentation.dto;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public record AdminFridgeOwnershipIssuesResponse(
        List<Issue> items,
        int page,
        int size,
        long totalElements,
        int totalPages
) {

    public record Issue(
            UUID bundleId,
            String bundleName,
            Integer labelNumber,
            UUID ownerUserId,
            String ownerName,
            String ownerLoginId,
            UUID roomId,
            String roomNumber,
            Short roomFloor,
            Short personalNo,
            UUID fridgeCompartmentId,
            Integer slotIndex,
            String compartmentType,
            Short fridgeFloorNo,
            String fridgeDisplayName,
            String issueType,
            OffsetDateTime createdAt,
            OffsetDateTime updatedAt
    ) {
    }
}

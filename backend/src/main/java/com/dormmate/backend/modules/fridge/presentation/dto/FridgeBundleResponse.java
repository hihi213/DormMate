package com.dormmate.backend.modules.fridge.presentation.dto;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record FridgeBundleResponse(
        UUID bundleId,
        UUID slotId,
        String slotCode,
        Integer labelNo,
        String labelDisplay,
        String bundleName,
        String memo,
        UUID ownerUserId,
        String ownerDisplayName,
        String ownerRoomNumber,
        String status,
        int itemCount,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt,
        OffsetDateTime removedAt,
        List<FridgeItemResponse> items
) {
}

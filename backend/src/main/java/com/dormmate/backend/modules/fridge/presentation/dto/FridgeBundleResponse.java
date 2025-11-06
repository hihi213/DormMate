package com.dormmate.backend.modules.fridge.presentation.dto;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record FridgeBundleResponse(
        UUID bundleId,
        UUID canonicalId,
        UUID slotId,
        int slotIndex,
        String slotLabel,
        Integer labelNumber,
        String labelDisplay,
        String bundleName,
        String memo,
        UUID ownerUserId,
        String ownerDisplayName,
        String ownerRoomNumber,
        String status,
        String freshness,
        int itemCount,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt,
        OffsetDateTime removedAt,
        Long version,
        List<FridgeItemResponse> items
) {
}

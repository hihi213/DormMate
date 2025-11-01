package com.dormmate.backend.modules.fridge.presentation.dto;

import java.time.OffsetDateTime;
import java.util.UUID;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record FridgeSlotResponse(
        UUID slotId,
        int slotIndex,
        String slotLetter,
        int floorNo,
        String floorCode,
        String compartmentType,
        String resourceStatus,
        boolean locked,
        OffsetDateTime lockedUntil,
        Integer capacity,
        String displayName,
        Integer occupiedCount
) {
}

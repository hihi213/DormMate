package com.dormmate.backend.modules.fridge.presentation.dto;

import java.util.UUID;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record FridgeSlotResponse(
        UUID slotId,
        String slotCode,
        int floor,
        String floorCode,
        String type,
        String status,
        Integer labelRangeStart,
        Integer labelRangeEnd,
        Integer capacity,
        String temperature,
        Integer displayOrder,
        String displayName,
        boolean isActive
) {
}

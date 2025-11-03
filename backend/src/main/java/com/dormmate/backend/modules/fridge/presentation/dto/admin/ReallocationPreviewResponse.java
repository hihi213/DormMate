package com.dormmate.backend.modules.fridge.presentation.dto.admin;

import java.util.List;
import java.util.UUID;

import com.dormmate.backend.modules.fridge.domain.CompartmentType;

public record ReallocationPreviewResponse(
        short floor,
        List<RoomSummary> rooms,
        List<CompartmentAllocationView> allocations,
        int chillCompartmentCount
) {

    public record RoomSummary(
            UUID roomId,
            String roomNumber,
            String roomType,
            short floor
    ) {
    }

    public record CompartmentAllocationView(
            UUID compartmentId,
            UUID fridgeUnitId,
            int slotIndex,
            String slotLabel,
            CompartmentType compartmentType,
            com.dormmate.backend.global.common.ResourceStatus status,
            boolean locked,
            List<UUID> currentRoomIds,
            List<UUID> recommendedRoomIds,
            List<String> warnings
    ) {
    }
}

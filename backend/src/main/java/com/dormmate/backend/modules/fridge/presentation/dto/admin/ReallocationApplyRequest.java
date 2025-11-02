package com.dormmate.backend.modules.fridge.presentation.dto.admin;

import java.util.List;
import java.util.UUID;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

public record ReallocationApplyRequest(
        @Min(value = 1, message = "floor must be positive")
        short floor,
        @NotEmpty(message = "allocations must not be empty")
        List<@Valid CompartmentAllocationInput> allocations
) {

    public record CompartmentAllocationInput(
            @NotNull(message = "compartmentId is required")
            UUID compartmentId,
            @NotNull(message = "roomIds is required")
            List<UUID> roomIds
    ) {
    }
}

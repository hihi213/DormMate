package com.dormmate.backend.modules.fridge.presentation.dto;

import java.util.List;

public record FridgeSlotListResponse(
        List<FridgeSlotResponse> items,
        long totalCount,
        int page,
        int size,
        int totalPages
) {
}

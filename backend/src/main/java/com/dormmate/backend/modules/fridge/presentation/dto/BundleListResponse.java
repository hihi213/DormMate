package com.dormmate.backend.modules.fridge.presentation.dto;

import java.util.List;

public record BundleListResponse(
        List<FridgeBundleSummaryResponse> items,
        long totalCount
) {
}

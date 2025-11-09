package com.dormmate.backend.modules.inspection.presentation.dto;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

import com.dormmate.backend.modules.fridge.presentation.dto.FridgeBundleResponse;
import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record InspectionSessionResponse(
        UUID sessionId,
        UUID slotId,
        int slotIndex,
        String slotLabel,
        int floorNo,
        String floorCode,
        String status,
        UUID startedBy,
        String startedByLogin,
        String startedByName,
        String startedByRoomNumber,
        Integer startedByPersonalNo,
        OffsetDateTime startedAt,
        OffsetDateTime endedAt,
        List<FridgeBundleResponse> bundles,
        List<InspectionActionSummaryResponse> summary,
        List<InspectionActionDetailResponse> actions,
        String notes,
        Integer initialBundleCount,
        Integer totalBundleCount
) {
}

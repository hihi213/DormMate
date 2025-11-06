package com.dormmate.backend.modules.inspection.presentation.dto;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record InspectionActionDetailResponse(
        Long actionId,
        String actionType,
        UUID bundleId,
        UUID targetUserId,
        OffsetDateTime recordedAt,
        UUID recordedBy,
        String note,
        UUID correlationId,
        List<InspectionActionItemResponse> items,
        List<PenaltyHistoryResponse> penalties,
        String roomNumber,
        Short personalNo,
        String notificationStatus,
        Integer penaltyPoints
) {
}

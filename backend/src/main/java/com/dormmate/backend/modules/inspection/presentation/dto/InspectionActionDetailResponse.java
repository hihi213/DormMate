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
        String recordedByLogin,
        String recordedByName,
        String note,
        UUID correlationId,
        String roomNumber,
        Integer personalNo,
        String targetName,
        List<InspectionActionItemResponse> items,
        List<PenaltyHistoryResponse> penalties
) {
}

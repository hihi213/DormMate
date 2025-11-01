package com.dormmate.backend.modules.inspection.presentation.dto;

import java.time.LocalDate;
import java.util.UUID;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record InspectionActionItemResponse(
        Long id,
        UUID fridgeItemId,
        String snapshotName,
        LocalDate snapshotExpiresOn,
        Integer quantityAtAction
) {
}

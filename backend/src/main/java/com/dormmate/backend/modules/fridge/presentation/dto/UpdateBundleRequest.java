package com.dormmate.backend.modules.fridge.presentation.dto;

import java.time.OffsetDateTime;

import jakarta.validation.constraints.Size;

public record UpdateBundleRequest(
        @Size(min = 1, max = 120) String bundleName,
        String memo,
        OffsetDateTime removedAt
) {
}

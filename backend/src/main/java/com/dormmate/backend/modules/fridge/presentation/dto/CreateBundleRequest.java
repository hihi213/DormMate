package com.dormmate.backend.modules.fridge.presentation.dto;

import java.util.List;
import java.util.UUID;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

public record CreateBundleRequest(
        @NotNull UUID slotId,
        @NotBlank String bundleName,
        String memo,
        @NotEmpty List<@Valid CreateBundleItemInput> items
) {
}

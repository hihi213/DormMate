package com.dormmate.backend.modules.fridge.presentation.dto;

import java.util.List;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;

public record CreateBundleRequest(
        @NotBlank String slotCode,
        @NotBlank String bundleName,
        String memo,
        @NotEmpty List<@Valid CreateBundleItemInput> items
) {
}

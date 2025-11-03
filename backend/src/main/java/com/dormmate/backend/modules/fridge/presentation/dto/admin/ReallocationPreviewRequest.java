package com.dormmate.backend.modules.fridge.presentation.dto.admin;

import jakarta.validation.constraints.Min;

public record ReallocationPreviewRequest(
        @Min(value = 1, message = "floor must be positive")
        short floor
) {
}

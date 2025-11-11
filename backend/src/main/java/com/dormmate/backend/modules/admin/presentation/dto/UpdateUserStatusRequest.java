package com.dormmate.backend.modules.admin.presentation.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record UpdateUserStatusRequest(
        @NotBlank String status,
        @NotBlank @Size(min = 2, max = 200) String reason
) {
}

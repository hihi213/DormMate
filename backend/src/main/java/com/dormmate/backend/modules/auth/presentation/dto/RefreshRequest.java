package com.dormmate.backend.modules.auth.presentation.dto;

import jakarta.validation.constraints.NotBlank;

public record RefreshRequest(
        @NotBlank(message = "refreshToken is required") String refreshToken,
        @NotBlank(message = "deviceId is required") String deviceId
) {
}

package com.dormmate.backend.modules.auth.presentation.dto;

import jakarta.validation.constraints.NotBlank;

public record LoginRequest(
        @NotBlank(message = "loginId is required") String loginId,
        @NotBlank(message = "password is required") String password,
        String deviceId
) {
}

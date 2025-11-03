package com.dormmate.backend.modules.notification.presentation.dto;

import jakarta.validation.constraints.NotNull;

public record UpdateNotificationPreferenceRequest(
        @NotNull(message = "enabled is required")
        Boolean enabled,
        @NotNull(message = "allowBackground is required")
        Boolean allowBackground
) {
}

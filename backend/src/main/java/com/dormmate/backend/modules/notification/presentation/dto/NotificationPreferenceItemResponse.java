package com.dormmate.backend.modules.notification.presentation.dto;

public record NotificationPreferenceItemResponse(
        String kindCode,
        String displayName,
        String description,
        boolean enabled,
        boolean allowBackground
) {
}

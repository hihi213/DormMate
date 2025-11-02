package com.dormmate.backend.modules.notification.presentation.dto;

import java.util.List;

public record NotificationPreferenceResponse(
        List<NotificationPreferenceItemResponse> items
) {
}

package com.dormmate.backend.modules.notification.presentation.dto;

import java.util.List;

public record NotificationListResponse(
        List<NotificationItemResponse> items,
        int page,
        int size,
        long totalElements,
        long unreadCount
) {
}

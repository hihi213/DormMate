package com.dormmate.backend.modules.notification.presentation.dto;

import java.time.OffsetDateTime;
import java.util.Map;
import java.util.UUID;

public record NotificationItemResponse(
        UUID id,
        String kindCode,
        String title,
        String body,
        String state,
        OffsetDateTime createdAt,
        OffsetDateTime readAt,
        OffsetDateTime ttlAt,
        UUID correlationId,
        Map<String, Object> metadata
) {
}

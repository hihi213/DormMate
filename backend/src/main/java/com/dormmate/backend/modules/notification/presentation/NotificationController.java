package com.dormmate.backend.modules.notification.presentation;

import java.util.List;
import java.util.Locale;
import java.util.UUID;

import com.dormmate.backend.global.security.SecurityUtils;
import com.dormmate.backend.modules.notification.application.NotificationService;
import com.dormmate.backend.modules.notification.application.NotificationService.NotificationFilterState;
import com.dormmate.backend.modules.notification.application.NotificationService.NotificationPageResult;
import com.dormmate.backend.modules.notification.application.NotificationService.NotificationPreferenceItem;
import com.dormmate.backend.modules.notification.application.NotificationService.NotificationPreferenceView;
import com.dormmate.backend.modules.notification.domain.Notification;
import com.dormmate.backend.modules.notification.presentation.dto.NotificationItemResponse;
import com.dormmate.backend.modules.notification.presentation.dto.NotificationListResponse;
import com.dormmate.backend.modules.notification.presentation.dto.NotificationPreferenceItemResponse;
import com.dormmate.backend.modules.notification.presentation.dto.NotificationPreferenceResponse;
import com.dormmate.backend.modules.notification.presentation.dto.UpdateNotificationPreferenceRequest;

import jakarta.validation.Valid;

import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

@RestController
@RequestMapping("/notifications")
public class NotificationController {

    private static final int MAX_PAGE_SIZE = 50;

    private final NotificationService notificationService;

    public NotificationController(NotificationService notificationService) {
        this.notificationService = notificationService;
    }

    @GetMapping
    public ResponseEntity<NotificationListResponse> getNotifications(
            @RequestParam(name = "state", defaultValue = "all") String stateParam,
            @RequestParam(name = "page", defaultValue = "0") int page,
            @RequestParam(name = "size", defaultValue = "20") int size
    ) {
        NotificationFilterState filter = parseState(stateParam);
        int safePage = Math.max(page, 0);
        int safeSize = Math.min(Math.max(size, 1), MAX_PAGE_SIZE);

        UUID userId = SecurityUtils.getCurrentUserId();
        NotificationPageResult result = notificationService.getNotifications(
                userId,
                filter,
                PageRequest.of(safePage, safeSize)
        );

        List<NotificationItemResponse> items = result.notifications().stream()
                .map(this::toItemResponse)
                .toList();

        NotificationListResponse response = new NotificationListResponse(
                items,
                result.page(),
                result.size(),
                result.totalElements(),
                result.unreadCount()
        );
        return ResponseEntity.ok(response);
    }

    @PatchMapping("/{notificationId}/read")
    public ResponseEntity<Void> markRead(@PathVariable("notificationId") UUID notificationId) {
        UUID userId = SecurityUtils.getCurrentUserId();
        notificationService.markNotificationRead(userId, notificationId);
        return ResponseEntity.noContent().build();
    }

    @PatchMapping("/read-all")
    public ResponseEntity<Void> markAllRead() {
        UUID userId = SecurityUtils.getCurrentUserId();
        notificationService.markAllNotificationsRead(userId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/preferences")
    public ResponseEntity<NotificationPreferenceResponse> getPreferences() {
        UUID userId = SecurityUtils.getCurrentUserId();
        NotificationPreferenceView view = notificationService.getPreferences(userId);
        List<NotificationPreferenceItemResponse> items = view.items().stream()
                .map(this::toPreferenceItemResponse)
                .toList();
        return ResponseEntity.ok(new NotificationPreferenceResponse(items));
    }

    @PatchMapping("/preferences/{kindCode}")
    public ResponseEntity<NotificationPreferenceItemResponse> updatePreference(
            @PathVariable("kindCode") String kindCode,
            @Valid @RequestBody UpdateNotificationPreferenceRequest request
    ) {
        UUID userId = SecurityUtils.getCurrentUserId();
        String normalizedKind = kindCode.toUpperCase(Locale.ROOT);
        NotificationPreferenceItem updated = notificationService.updatePreference(
                userId,
                normalizedKind,
                request.enabled(),
                request.allowBackground()
        );
        return ResponseEntity.ok(toPreferenceItemResponse(updated));
    }

    private NotificationItemResponse toItemResponse(Notification notification) {
        return new NotificationItemResponse(
                notification.getId(),
                notification.getKindCode(),
                notification.getTitle(),
                notification.getBody(),
                notification.getState().name(),
                notification.getCreatedAt(),
                notification.getReadAt(),
                notification.getTtlAt(),
                notification.getCorrelationId(),
                notification.getMetadata()
        );
    }

    private NotificationPreferenceItemResponse toPreferenceItemResponse(NotificationPreferenceItem item) {
        return new NotificationPreferenceItemResponse(
                item.kindCode(),
                item.displayName(),
                item.description(),
                item.enabled(),
                item.allowBackground()
        );
    }

    private NotificationFilterState parseState(String value) {
        String normalized = value == null ? "all" : value.trim().toLowerCase(Locale.ROOT);
        return switch (normalized) {
            case "all" -> NotificationFilterState.ALL;
            case "unread" -> NotificationFilterState.UNREAD;
            case "read" -> NotificationFilterState.READ;
            default -> throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "INVALID_STATE");
        };
    }
}

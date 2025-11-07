package com.dormmate.backend.modules.notification.application;

import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.EnumMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

import com.dormmate.backend.modules.auth.domain.DormUser;
import com.dormmate.backend.modules.auth.infrastructure.persistence.DormUserRepository;
import com.dormmate.backend.modules.notification.domain.Notification;
import com.dormmate.backend.modules.notification.domain.NotificationPreference;
import com.dormmate.backend.modules.notification.domain.NotificationPreferenceId;
import com.dormmate.backend.modules.notification.domain.NotificationState;
import com.dormmate.backend.modules.notification.infrastructure.persistence.NotificationPreferenceRepository;
import com.dormmate.backend.modules.notification.infrastructure.persistence.NotificationRepository;
import com.dormmate.backend.modules.inspection.domain.InspectionAction;
import com.dormmate.backend.modules.inspection.domain.InspectionActionType;
import com.dormmate.backend.modules.inspection.domain.InspectionSession;
import com.dormmate.backend.modules.inspection.domain.InspectionActionItem;
import com.dormmate.backend.modules.penalty.domain.PenaltyHistory;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.CollectionUtils;
import org.springframework.web.server.ResponseStatusException;

@Service
@Transactional
public class NotificationService {

    private static final String KIND_INSPECTION_RESULT = "FRIDGE_RESULT";
    public static final String KIND_FRIDGE_SCHEDULE = "FRIDGE_SCHEDULE";
    public static final String KIND_FRIDGE_EXPIRY = "FRIDGE_EXPIRY";
    public static final String KIND_FRIDGE_EXPIRED = "FRIDGE_EXPIRED";
    private static final int DEFAULT_TTL_HOURS = 24 * 7;
    public static final int DEFAULT_SCHEDULE_TTL_HOURS = 24 * 3;
    private static final String DEDUPE_PREFIX = "FRIDGE_RESULT:";

    private static final List<PreferenceDefinition> SUPPORTED_PREFERENCES = List.of(
            new PreferenceDefinition(
                    KIND_INSPECTION_RESULT,
                    "냉장고 검사 결과",
                    "검사 조치 및 벌점 알림",
                    true,
                    true
            ),
            new PreferenceDefinition(
                    KIND_FRIDGE_SCHEDULE,
                    "냉장고 검사 일정",
                    "다가오는 검사 일정을 안내합니다",
                    true,
                    true
            ),
            new PreferenceDefinition(
                    KIND_FRIDGE_EXPIRY,
                    "냉장고 임박 알림",
                    "유통기한 3일 이내 물품 안내",
                    true,
                    false
            ),
            new PreferenceDefinition(
                    KIND_FRIDGE_EXPIRED,
                    "냉장고 만료 알림",
                    "유통기한이 지난 물품 경고",
                    true,
                    true
            )
    );

    private static final Map<String, PreferenceDefinition> PREFERENCE_BY_CODE = SUPPORTED_PREFERENCES.stream()
            .collect(Collectors.toUnmodifiableMap(PreferenceDefinition::kindCode, definition -> definition));

    private final NotificationRepository notificationRepository;
    private final NotificationPreferenceRepository notificationPreferenceRepository;
    private final DormUserRepository dormUserRepository;
    private final Clock clock;

    public NotificationService(
            NotificationRepository notificationRepository,
            NotificationPreferenceRepository notificationPreferenceRepository,
            DormUserRepository dormUserRepository,
            Clock clock
    ) {
        this.notificationRepository = notificationRepository;
        this.notificationPreferenceRepository = notificationPreferenceRepository;
        this.dormUserRepository = dormUserRepository;
        this.clock = clock;
    }

    public NotificationPageResult getNotifications(UUID userId, NotificationFilterState filter, Pageable pageable) {
        expireNotifications(userId);

        List<NotificationState> states = switch (filter) {
            case ALL -> List.of(NotificationState.UNREAD, NotificationState.READ);
            case UNREAD -> List.of(NotificationState.UNREAD);
            case READ -> List.of(NotificationState.READ);
        };

        Page<Notification> page = notificationRepository.findByUserIdAndStates(userId, states, pageable);
        long unreadCount = notificationRepository.countByUserIdAndState(userId, NotificationState.UNREAD);

        return new NotificationPageResult(
                page.getContent(),
                page.getNumber(),
                page.getSize(),
                page.getTotalElements(),
                unreadCount
        );
    }

    public void markNotificationRead(UUID userId, UUID notificationId) {
        Notification notification = notificationRepository.findByIdAndUserId(notificationId, userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "NOTIFICATION_NOT_FOUND"));

        if (notification.getState() == NotificationState.EXPIRED) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "NOTIFICATION_EXPIRED");
        }

        if (notification.getState() == NotificationState.UNREAD) {
            notification.markRead(OffsetDateTime.now(clock));
            notificationRepository.save(notification);
        }
    }

    public int markAllNotificationsRead(UUID userId) {
        List<Notification> unread = notificationRepository.findByUserIdAndState(userId, NotificationState.UNREAD);
        if (unread.isEmpty()) {
            return 0;
        }
        OffsetDateTime now = OffsetDateTime.now(clock);
        unread.forEach(notification -> notification.markRead(now));
        notificationRepository.saveAll(unread);
        return unread.size();
    }

    @Transactional(readOnly = true)
    public NotificationPreferenceView getPreferences(UUID userId) {
        Map<String, NotificationPreference> existing = notificationPreferenceRepository.findByIdUserId(userId).stream()
                .collect(Collectors.toMap(pref -> pref.getId().getKindCode(), pref -> pref));

        List<NotificationPreferenceItem> items = SUPPORTED_PREFERENCES.stream()
                .map(definition -> {
                    NotificationPreference preference = existing.get(definition.kindCode());
                    boolean enabled = preference != null ? preference.isEnabled() : definition.defaultEnabled();
                    boolean allowBackground = preference != null ? preference.isAllowBackground() : definition.defaultAllowBackground();
                    return new NotificationPreferenceItem(
                            definition.kindCode(),
                            definition.displayName(),
                            definition.description(),
                            enabled,
                            allowBackground
                    );
                })
                .toList();

        return new NotificationPreferenceView(items);
    }

    public NotificationPreferenceItem updatePreference(UUID userId, String kindCode, boolean enabled, boolean allowBackground) {
        PreferenceDefinition definition = PREFERENCE_BY_CODE.get(kindCode);
        if (definition == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "PREFERENCE_NOT_FOUND");
        }

        NotificationPreference preference = notificationPreferenceRepository
                .findByIdUserIdAndIdKindCode(userId, kindCode)
                .orElseGet(() -> new NotificationPreference(
                        new NotificationPreferenceId(userId, kindCode),
                        dormUserRepository.getReferenceById(userId)
                ));
        preference.setEnabled(enabled);
        preference.setAllowBackground(allowBackground);
        notificationPreferenceRepository.save(preference);

        return new NotificationPreferenceItem(
                definition.kindCode(),
                definition.displayName(),
                definition.description(),
                enabled,
                allowBackground
        );
    }

    public void sendInspectionResultNotifications(InspectionSession session) {
        if (CollectionUtils.isEmpty(session.getActions())) {
            return;
        }

        Map<DormUser, UserInspectionSummary> summaries = new java.util.LinkedHashMap<>();
        for (InspectionAction action : session.getActions()) {
            DormUser target = action.getTargetUser();
            if (target == null) {
                continue;
            }

            InspectionActionType type = action.getActionType();
            if (type == InspectionActionType.PASS) {
                continue;
            }

            summaries.computeIfAbsent(target, key -> new UserInspectionSummary())
                    .increment(type);
        }

        Map<UUID, List<InspectionAction>> actionsByUser = session.getActions().stream()
                .filter(action -> action.getTargetUser() != null)
                .collect(Collectors.groupingBy(action -> action.getTargetUser().getId(), LinkedHashMap::new, Collectors.toList()));
        summaries.forEach((user, summary) -> {
            if (summary.isEmpty()) {
                return;
            }

            if (!isEnabled(user.getId(), KIND_INSPECTION_RESULT)) {
                return;
            }

            String dedupeKey = DEDUPE_PREFIX + session.getId() + ":" + user.getId();
            Optional<Notification> existing = notificationRepository.findByUserIdAndDedupeKey(user.getId(), dedupeKey);
            if (existing.isPresent()) {
                return;
            }

            List<InspectionAction> actionsForUser = actionsByUser.getOrDefault(user.getId(), List.of());
            List<Long> actionIds = actionsForUser.stream()
                    .map(InspectionAction::getId)
                    .filter(Objects::nonNull)
                    .toList();
            List<UUID> actionCorrelationIds = actionsForUser.stream()
                    .map(InspectionAction::getCorrelationId)
                    .filter(Objects::nonNull)
                    .toList();
            List<Long> actionItemIds = actionsForUser.stream()
                    .flatMap(action -> action.getItems().stream())
                    .map(InspectionActionItem::getId)
                    .filter(Objects::nonNull)
                    .toList();
            List<UUID> actionItemCorrelationIds = actionsForUser.stream()
                    .flatMap(action -> action.getItems().stream())
                    .map(InspectionActionItem::getCorrelationId)
                    .filter(Objects::nonNull)
                    .toList();
            List<UUID> penaltyIds = actionsForUser.stream()
                    .flatMap(action -> action.getPenalties().stream())
                    .map(PenaltyHistory::getId)
                    .filter(Objects::nonNull)
                    .toList();
            List<UUID> penaltyCorrelationIds = actionsForUser.stream()
                    .flatMap(action -> action.getPenalties().stream())
                    .map(PenaltyHistory::getCorrelationId)
                    .filter(Objects::nonNull)
                    .toList();

            Map<String, Object> metadata = new java.util.LinkedHashMap<>();
            metadata.put("sessionId", session.getId());
            metadata.put("actionIds", actionIds);
            metadata.put("actionItemIds", actionItemIds);
            metadata.put("penaltyHistoryIds", penaltyIds);
            metadata.put("actionCorrelationIds", actionCorrelationIds);
            metadata.put("actionItemCorrelationIds", actionItemCorrelationIds);
            metadata.put("penaltyCorrelationIds", penaltyCorrelationIds);

            createNotification(
                    user,
                    KIND_INSPECTION_RESULT,
                    "[냉장고] 검사 결과",
                    summary.toMessage(),
                    dedupeKey,
                    metadata,
                    DEFAULT_TTL_HOURS,
                    session.getId()
            );
        });
    }

    private boolean isEnabled(UUID userId, String kindCode) {
        NotificationPreferenceId id = new NotificationPreferenceId(userId, kindCode);
        Optional<NotificationPreference> preference = notificationPreferenceRepository.findById(id);
        if (preference.isPresent()) {
            return preference.get().isEnabled();
        }
        PreferenceDefinition definition = PREFERENCE_BY_CODE.get(kindCode);
        return definition == null || definition.defaultEnabled();
    }

    public Optional<Notification> sendNotification(
            UUID userId,
            String kindCode,
            String title,
            String body,
            String dedupeKey,
            Map<String, Object> metadata,
            int ttlHours,
            UUID correlationId
    ) {
        DormUser user = dormUserRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "USER_NOT_FOUND"));
        return createNotification(user, kindCode, title, body, dedupeKey, metadata, ttlHours, correlationId);
    }

    private Optional<Notification> createNotification(
            DormUser user,
            String kindCode,
            String title,
            String body,
            String dedupeKey,
            Map<String, Object> metadata,
            int ttlHours,
            UUID correlationId
    ) {
        if (!isEnabled(user.getId(), kindCode)) {
            return Optional.empty();
        }

        if (dedupeKey != null && notificationRepository.findByUserIdAndDedupeKey(user.getId(), dedupeKey).isPresent()) {
            return Optional.empty();
        }

        OffsetDateTime now = OffsetDateTime.now(clock);

        Notification notification = new Notification();
        notification.setUser(user);
        notification.setKindCode(kindCode);
        notification.setTitle(title);
        notification.setBody(body);
        notification.setState(NotificationState.UNREAD);
        notification.setDedupeKey(dedupeKey);
        notification.setTtlAt(now.plusHours(ttlHours));
        notification.setCorrelationId(correlationId);
        notification.setMetadata(metadata == null ? Map.of() : metadata);

        notificationRepository.save(notification);
        return Optional.of(notification);
    }

    public Notification createFailureNotification(
            DormUser user,
            String kindCode,
            String title,
            String body,
            Map<String, Object> metadata
    ) {
        OffsetDateTime now = OffsetDateTime.now(clock);
        Notification notification = new Notification();
        notification.setUser(user);
        notification.setKindCode(kindCode);
        notification.setTitle(title);
        notification.setBody(body);
        notification.setState(NotificationState.EXPIRED);
        notification.setTtlAt(now);
        notification.setExpiredAt(now);
        notification.setMetadata(metadata == null ? Map.of() : metadata);
        notificationRepository.save(notification);
        return notification;
    }

    private void expireNotifications(UUID userId) {
        OffsetDateTime now = OffsetDateTime.now(clock);
        List<Notification> expirable = notificationRepository.findByUserIdAndTtlAtBeforeAndStateNot(
                userId,
                now,
                NotificationState.EXPIRED
        );
        if (expirable.isEmpty()) {
            return;
        }
        expirable.forEach(notification -> notification.markExpired(now));
        notificationRepository.saveAll(expirable);
    }

    public enum NotificationFilterState {
        ALL,
        UNREAD,
        READ
    }

    public record NotificationPageResult(
            List<Notification> notifications,
            int page,
            int size,
            long totalElements,
            long unreadCount
    ) {
    }

    public record NotificationPreferenceView(List<NotificationPreferenceItem> items) {
    }

    public record NotificationPreferenceItem(
            String kindCode,
            String displayName,
            String description,
            boolean enabled,
            boolean allowBackground
    ) {
    }

    private record PreferenceDefinition(
            String kindCode,
            String displayName,
            String description,
            boolean defaultEnabled,
            boolean defaultAllowBackground
    ) {
    }

    private static final class UserInspectionSummary {
        private final EnumMap<InspectionActionType, Integer> counter = new EnumMap<>(InspectionActionType.class);

        void increment(InspectionActionType type) {
            counter.merge(type, 1, Integer::sum);
        }

        boolean isEmpty() {
            return counter.isEmpty();
        }

        String toMessage() {
            int warnCount = getCount(InspectionActionType.WARN_INFO_MISMATCH)
                    + getCount(InspectionActionType.WARN_STORAGE_POOR);
            int disposeCount = getCount(InspectionActionType.DISPOSE_EXPIRED);
            int unregisteredCount = getCount(InspectionActionType.UNREGISTERED_DISPOSE);

            java.util.List<String> parts = new java.util.ArrayList<>();
            if (warnCount > 0) {
                parts.add("경고 " + warnCount + "건");
            }
            if (disposeCount > 0) {
                parts.add("폐기 " + disposeCount + "건");
            }
            if (unregisteredCount > 0) {
                parts.add("미등록 폐기 " + unregisteredCount + "건");
            }

            String summary = parts.isEmpty() ? "이상 없음" : String.join(", ", parts);
            return summary + "이 발생했습니다. 세부 내역을 확인해주세요.";
        }

        private int getCount(InspectionActionType type) {
            return counter.getOrDefault(type, 0);
        }
    }
}

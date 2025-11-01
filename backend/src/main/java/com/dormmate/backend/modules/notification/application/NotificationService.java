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

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.CollectionUtils;

@Service
@Transactional
public class NotificationService {

    private static final String KIND_INSPECTION_RESULT = "FRIDGE_RESULT";
    private static final int DEFAULT_TTL_HOURS = 24 * 7;
    private static final String DEDUPE_PREFIX = "FRIDGE_RESULT:";

    private final NotificationRepository notificationRepository;
    private final NotificationPreferenceRepository notificationPreferenceRepository;
    private final Clock clock;

    public NotificationService(
            NotificationRepository notificationRepository,
            NotificationPreferenceRepository notificationPreferenceRepository,
            Clock clock
    ) {
        this.notificationRepository = notificationRepository;
        this.notificationPreferenceRepository = notificationPreferenceRepository;
        this.clock = clock;
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

        OffsetDateTime now = OffsetDateTime.now(clock);
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

            String title = "[냉장고] 검사 결과";
            String body = summary.toMessage();

            Notification notification = new Notification();
            notification.setUser(user);
            notification.setKindCode(KIND_INSPECTION_RESULT);
            notification.setTitle(title);
            notification.setBody(body);
            notification.setState(NotificationState.UNREAD);
            notification.setDedupeKey(dedupeKey);
            notification.setTtlAt(now.plusHours(DEFAULT_TTL_HOURS));
            notification.setCorrelationId(session.getId());

            List<InspectionAction> actionsForUser = actionsByUser.getOrDefault(user.getId(), List.of());
            List<Long> actionIds = actionsForUser.stream()
                    .map(InspectionAction::getId)
                    .filter(Objects::nonNull)
                    .toList();
            List<Long> actionItemIds = actionsForUser.stream()
                    .flatMap(action -> action.getItems().stream())
                    .map(InspectionActionItem::getId)
                    .filter(Objects::nonNull)
                    .toList();
            List<UUID> penaltyIds = actionsForUser.stream()
                    .flatMap(action -> action.getPenalties().stream())
                    .map(PenaltyHistory::getId)
                    .filter(Objects::nonNull)
                    .toList();

            Map<String, Object> metadata = new java.util.LinkedHashMap<>();
            metadata.put("sessionId", session.getId());
            metadata.put("actionIds", actionIds);
            metadata.put("actionItemIds", actionItemIds);
            metadata.put("penaltyHistoryIds", penaltyIds);
            notification.setMetadata(metadata);

            notificationRepository.save(notification);
        });
    }

    private boolean isEnabled(UUID userId, String kindCode) {
        NotificationPreferenceId id = new NotificationPreferenceId(userId, kindCode);
        Optional<NotificationPreference> preference = notificationPreferenceRepository.findById(id);
        return preference.map(NotificationPreference::isEnabled).orElse(true);
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

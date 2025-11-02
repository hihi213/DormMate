package com.dormmate.backend.modules.notification.application;

import static com.dormmate.backend.modules.notification.application.NotificationService.KIND_FRIDGE_EXPIRED;
import static com.dormmate.backend.modules.notification.application.NotificationService.KIND_FRIDGE_EXPIRY;

import java.time.Clock;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.stream.Collectors;

import com.dormmate.backend.modules.auth.domain.DormUser;
import com.dormmate.backend.modules.fridge.domain.FridgeItem;
import com.dormmate.backend.modules.fridge.domain.FridgeItemStatus;
import com.dormmate.backend.modules.fridge.infrastructure.persistence.FridgeItemRepository;
import com.dormmate.backend.modules.notification.domain.Notification;
import com.dormmate.backend.modules.notification.domain.NotificationDispatchLog;
import com.dormmate.backend.modules.notification.domain.NotificationDispatchStatus;
import com.dormmate.backend.modules.notification.infrastructure.persistence.NotificationDispatchLogRepository;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class FridgeExpiryNotificationScheduler {

    private static final Logger log = LoggerFactory.getLogger(FridgeExpiryNotificationScheduler.class);
    private static final DateTimeFormatter DATE_KEY_FORMAT = DateTimeFormatter.BASIC_ISO_DATE;
    private static final String ERROR_EXPIRY_FAILED = "EXPIRY_BATCH_FAILED";
    private static final String ERROR_EXPIRED_FAILED = "EXPIRED_BATCH_FAILED";
    private static final int EXPIRY_LOOKAHEAD_DAYS = 3;
    private static final int TTL_HOURS_EXPIRY = 24;
    private static final int TTL_HOURS_EXPIRED = 24 * 7;

    private final FridgeItemRepository fridgeItemRepository;
    private final NotificationService notificationService;
    private final NotificationDispatchLogRepository notificationDispatchLogRepository;
    private final Clock clock;

    public FridgeExpiryNotificationScheduler(
            FridgeItemRepository fridgeItemRepository,
            NotificationService notificationService,
            NotificationDispatchLogRepository notificationDispatchLogRepository,
            Clock clock
    ) {
        this.fridgeItemRepository = fridgeItemRepository;
        this.notificationService = notificationService;
        this.notificationDispatchLogRepository = notificationDispatchLogRepository;
        this.clock = clock;
    }

    @Scheduled(cron = "0 0 9 * * *")
    @Transactional
    public void runDailyBatch() {
        LocalDate today = LocalDate.now(clock);
        LocalDate expiryThreshold = today.plusDays(EXPIRY_LOOKAHEAD_DAYS);

        processNotifications(
                fridgeItemRepository.findActiveItemsExpiringBetween(
                        FridgeItemStatus.ACTIVE,
                        today,
                        expiryThreshold
                ),
                KIND_FRIDGE_EXPIRY,
                "[냉장고] 유통기한 임박",
                "임박했습니다.",
                today,
                ERROR_EXPIRY_FAILED,
                TTL_HOURS_EXPIRY
        );

        processNotifications(
                fridgeItemRepository.findActiveItemsExpiredBefore(
                        FridgeItemStatus.ACTIVE,
                        today
                ),
                KIND_FRIDGE_EXPIRED,
                "[냉장고] 유통기한 만료",
                "지났습니다.",
                today,
                ERROR_EXPIRED_FAILED,
                TTL_HOURS_EXPIRED
        );
    }

    private void processNotifications(
            List<FridgeItem> items,
            String kindCode,
            String title,
            String messageSuffix,
            LocalDate batchDate,
            String errorCode,
            int ttlHours
    ) {
        if (items.isEmpty()) {
            return;
        }

        String dateKey = batchDate.format(DATE_KEY_FORMAT);

        Map<DormUser, List<FridgeItem>> grouped = items.stream()
                .collect(Collectors.groupingBy(
                        item -> item.getBundle().getOwner(),
                        Collectors.mapping(item -> item, Collectors.toCollection(ArrayList::new))
                ));

        grouped.forEach((owner, ownerItems) -> {
            if (owner == null || ownerItems.isEmpty()) {
                return;
            }

            int count = ownerItems.size();
            List<String> sampleNames = ownerItems.stream()
                    .map(FridgeItem::getItemName)
                    .filter(Objects::nonNull)
                    .distinct()
                    .limit(3)
                    .toList();

            StringBuilder bodyBuilder = new StringBuilder()
                    .append(count)
                    .append("개 물품의 유통기한이 ")
                    .append(messageSuffix);
            if (!sampleNames.isEmpty()) {
                bodyBuilder.append(" (예: ")
                        .append(String.join(", ", sampleNames))
                        .append(")");
            }
            String body = bodyBuilder.toString();

            Map<String, Object> metadata = Map.of(
                    "type", kindCode,
                    "batchDate", batchDate.toString(),
                    "count", count,
                    "sampleNames", sampleNames
            );

            String dedupeKey = kindCode + ":" + owner.getId() + ":" + dateKey;

            try {
                Optional<Notification> created = notificationService.sendNotification(
                        owner.getId(),
                        kindCode,
                        title,
                        body,
                        dedupeKey,
                        metadata,
                        ttlHours,
                        null
                );

                created.ifPresent(notification -> recordDispatchLog(notification, NotificationDispatchStatus.SUCCESS, null, null));
            } catch (Exception ex) {
                log.warn("[ALERT][Batch][{}] attempt={} user={} errorCode={} detail={}",
                        kindCode,
                        1,
                        owner.getId(),
                        errorCode,
                        ex.getMessage(),
                        ex);
                Notification failureNotification = notificationService.createFailureNotification(
                        owner,
                        kindCode,
                        title,
                        body,
                        metadata
                );
                recordDispatchLog(
                        failureNotification,
                        NotificationDispatchStatus.FAILED,
                        errorCode,
                        ex.getMessage()
                );
            }
        });
    }

    private void recordDispatchLog(
            Notification notification,
            NotificationDispatchStatus status,
            String errorCode,
            String errorMessage
    ) {
        NotificationDispatchLog logEntry = new NotificationDispatchLog();
        logEntry.setNotification(notification);
        logEntry.setChannel("INTERNAL_BATCH");
        logEntry.setStatus(status);
        logEntry.setErrorCode(errorCode);
        logEntry.setErrorMessage(errorMessage);
        logEntry.setLoggedAt(OffsetDateTime.now(clock));
        notificationDispatchLogRepository.save(logEntry);
    }
}

package com.dormmate.backend.modules.notification;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

import com.dormmate.backend.modules.auth.domain.DormUser;
import com.dormmate.backend.modules.auth.infrastructure.persistence.DormUserRepository;
import com.dormmate.backend.modules.fridge.domain.FridgeBundle;
import com.dormmate.backend.modules.fridge.domain.FridgeItem;
import com.dormmate.backend.modules.fridge.domain.FridgeItemStatus;
import com.dormmate.backend.modules.fridge.infrastructure.persistence.FridgeBundleRepository;
import com.dormmate.backend.modules.fridge.infrastructure.persistence.FridgeItemRepository;
import com.dormmate.backend.modules.notification.application.FridgeExpiryNotificationScheduler;
import com.dormmate.backend.modules.notification.domain.Notification;
import com.dormmate.backend.modules.notification.domain.NotificationDispatchLog;
import com.dormmate.backend.modules.notification.domain.NotificationDispatchStatus;
import com.dormmate.backend.modules.notification.infrastructure.persistence.NotificationDispatchLogRepository;
import com.dormmate.backend.modules.notification.infrastructure.persistence.NotificationRepository;
import com.dormmate.backend.support.AbstractPostgresIntegrationTest;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.transaction.annotation.Transactional;

import static org.mockito.Mockito.when;
import java.util.stream.Collectors;

@SpringBootTest
@AutoConfigureMockMvc
class FridgeExpiryNotificationSchedulerIntegrationTest extends AbstractPostgresIntegrationTest {

    private static final LocalDate FIXED_DATE = LocalDate.of(2025, 1, 15);

    @Autowired
    private FridgeExpiryNotificationScheduler scheduler;

    @Autowired
    private FridgeItemRepository fridgeItemRepository;

    @Autowired
    private FridgeBundleRepository fridgeBundleRepository;

    @Autowired
    private DormUserRepository dormUserRepository;

    @Autowired
    private NotificationRepository notificationRepository;

    @Autowired
    private NotificationDispatchLogRepository notificationDispatchLogRepository;

    @MockBean
    private Clock clock;

    private DormUser owner;
    private FridgeBundle ownerBundle;
    private DormUser originalBundleOwner;
    private final List<UUID> createdItemIds = new ArrayList<>();

    @BeforeEach
    void setUp() {
        Instant fixedInstant = FIXED_DATE.atStartOfDay().toInstant(ZoneOffset.UTC);
        when(clock.instant()).thenReturn(fixedInstant);
        when(clock.getZone()).thenReturn(ZoneOffset.UTC);

        owner = dormUserRepository.findByLoginIdIgnoreCase("alice")
                .orElseThrow(() -> new IllegalStateException("alice user not found"));
        ownerBundle = fridgeBundleRepository.findAll().stream()
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("bundle not found"));
        originalBundleOwner = ownerBundle.getOwner();
        ownerBundle.setOwner(owner);
        fridgeBundleRepository.save(ownerBundle);
    }

    @AfterEach
    void tearDown() {
        notificationDispatchLogRepository.deleteAll();
        notificationRepository.deleteAll();
        createdItemIds.forEach(fridgeItemRepository::deleteById);
        createdItemIds.clear();
        if (ownerBundle != null && originalBundleOwner != null) {
            ownerBundle.setOwner(originalBundleOwner);
            fridgeBundleRepository.save(ownerBundle);
        }
    }

    @Test
    @Transactional
    void runDailyBatchCreatesExpiryAndExpiredNotifications() {
        LocalDate today = FIXED_DATE;

        buildItem("우유", today.plusDays(2));
        buildItem("요거트", today.plusDays(1));
        buildItem("김치", today.minusDays(1));

        scheduler.runDailyBatch();

        List<Notification> notifications = notificationRepository.findAll();
        Map<String, Long> countsByKind = notifications.stream()
                .collect(Collectors.groupingBy(Notification::getKindCode, Collectors.counting()));

        assertThat(countsByKind.get("FRIDGE_EXPIRY")).isEqualTo(1L);
        assertThat(countsByKind.get("FRIDGE_EXPIRED")).isEqualTo(1L);

        Notification expiryNotification = notifications.stream()
                .filter(notification -> notification.getKindCode().equals("FRIDGE_EXPIRY"))
                .findFirst()
                .orElseThrow();
        assertThat(expiryNotification.getBody()).contains("임박");
        assertThat(expiryNotification.getMetadata()).containsEntry("count", 2);

        List<NotificationDispatchLog> dispatchLogs = notificationDispatchLogRepository
                .findByNotification_Id(expiryNotification.getId());
        assertThat(dispatchLogs).isNotEmpty();
        assertThat(dispatchLogs.getFirst().getStatus()).isEqualTo(NotificationDispatchStatus.SUCCESS);

        // Deduplication check
        scheduler.runDailyBatch();
        assertThat(notificationRepository.count()).isEqualTo(2);
    }

    private FridgeItem buildItem(String name, LocalDate expiryDate) {
        FridgeItem item = new FridgeItem();
        item.setBundle(ownerBundle);
        item.setItemName(name);
        item.setStatus(FridgeItemStatus.ACTIVE);
        item.setExpiryDate(expiryDate);
        item.setQuantity(1);
        item.setUnitCode("EA");
        FridgeItem saved = fridgeItemRepository.save(item);
        createdItemIds.add(saved.getId());
        return saved;
    }
}

package com.dormmate.backend.modules.notification;

import static com.dormmate.backend.support.TestResidentAccounts.DEFAULT_PASSWORD;
import static com.dormmate.backend.support.TestResidentAccounts.FLOOR2_ROOM05_SLOT1;
import static com.dormmate.backend.modules.notification.application.NotificationService.KIND_FRIDGE_EXPIRED;
import static com.dormmate.backend.modules.notification.application.NotificationService.KIND_FRIDGE_EXPIRY;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
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
import com.dormmate.backend.modules.fridge.domain.FridgeCompartment;
import com.dormmate.backend.modules.fridge.infrastructure.persistence.FridgeBundleRepository;
import com.dormmate.backend.modules.fridge.infrastructure.persistence.FridgeItemRepository;
import com.dormmate.backend.modules.fridge.infrastructure.persistence.FridgeCompartmentRepository;
import com.dormmate.backend.modules.notification.application.FridgeExpiryNotificationScheduler;
import com.dormmate.backend.modules.notification.application.NotificationService;
import com.dormmate.backend.modules.notification.domain.Notification;
import com.dormmate.backend.modules.notification.domain.NotificationDispatchLog;
import com.dormmate.backend.modules.notification.domain.NotificationDispatchStatus;
import com.dormmate.backend.modules.notification.domain.NotificationPreference;
import com.dormmate.backend.modules.notification.domain.NotificationPreferenceId;
import com.dormmate.backend.modules.notification.infrastructure.persistence.NotificationDispatchLogRepository;
import com.dormmate.backend.modules.notification.infrastructure.persistence.NotificationPreferenceRepository;
import com.dormmate.backend.modules.notification.infrastructure.persistence.NotificationRepository;
import com.dormmate.backend.support.AbstractPostgresIntegrationTest;
import com.dormmate.backend.support.TestUserFactory;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.SpyBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@AutoConfigureMockMvc
class FridgeExpiryNotificationSchedulerIntegrationTest extends AbstractPostgresIntegrationTest {

    private static final LocalDate FIXED_DATE = LocalDate.of(2025, 1, 15);
    private static final int SLOT_INDEX_A = 0;

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

    @Autowired
    private NotificationPreferenceRepository notificationPreferenceRepository;

    @Autowired
    private FridgeCompartmentRepository fridgeCompartmentRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private TestUserFactory testUserFactory;

    @SpyBean
    private NotificationService notificationService;

    private DormUser owner;
    private FridgeBundle ownerBundle;
    private final List<UUID> createdItemIds = new ArrayList<>();
    private UUID slot2FAId;

    @BeforeEach
    void setUp() {
        resetNotificationArtifacts();
        ensureResident(FLOOR2_ROOM05_SLOT1, DEFAULT_PASSWORD);
        owner = dormUserRepository.findByLoginIdIgnoreCase(FLOOR2_ROOM05_SLOT1)
                .orElseThrow(() -> new IllegalStateException("primary resident user not found"));
        slot2FAId = fetchSlotId((short) 2, SLOT_INDEX_A);
        ownerBundle = createOwnerBundle();
        ensurePreferenceEnabled(KIND_FRIDGE_EXPIRY, true);
        ensurePreferenceEnabled(KIND_FRIDGE_EXPIRED, true);
    }

    @AfterEach
    void tearDown() {
        resetNotificationArtifacts();
        createdItemIds.forEach(fridgeItemRepository::deleteById);
        createdItemIds.clear();
        if (ownerBundle != null) {
            fridgeBundleRepository.deleteById(ownerBundle.getId());
        }
    }

    private void ensureResident(String loginId, String password) {
        String roomNumber = loginId.split("-")[0];
        short floor = Short.parseShort(roomNumber.substring(0, 1));
        short personalNo = Short.parseShort(loginId.split("-")[1]);
        testUserFactory.ensureResident(loginId, password, floor, roomNumber, personalNo);
    }

    @Test
    @Transactional
    void runDailyBatchCreatesExpiryAndExpiredNotifications() {
        LocalDate today = FIXED_DATE;

        buildItem("우유", today.plusDays(2));
        buildItem("요거트", today.plusDays(1));
        buildItem("김치", today.minusDays(1));

        var expiringItems = fridgeItemRepository.findActiveItemsExpiringBetween(
                FridgeItemStatus.ACTIVE,
                today,
                today.plusDays(3)
        );
        var expiredItems = fridgeItemRepository.findActiveItemsExpiredBefore(
                FridgeItemStatus.ACTIVE,
                today
        );
        assertThat(expiringItems)
                .describedAs("Expiring items prepared for batch")
                .hasSize(2);
        assertThat(expiredItems)
                .describedAs("Expired items prepared for batch")
                .hasSize(1);

        scheduler.runDailyBatch();

        List<Notification> notifications = notificationRepository.findAll();
        Map<String, Long> countsByKind = notifications.stream()
                .collect(Collectors.groupingBy(Notification::getKindCode, Collectors.counting()));

        assertThat(countsByKind.get(KIND_FRIDGE_EXPIRY))
                .describedAs("Actual counts after batch: %s", countsByKind)
                .isEqualTo(1L);
        assertThat(countsByKind.get(KIND_FRIDGE_EXPIRED))
                .describedAs("Actual counts after batch: %s", countsByKind)
                .isEqualTo(1L);

        Notification expiryNotification = notifications.stream()
                .filter(notification -> notification.getKindCode().equals(KIND_FRIDGE_EXPIRY))
                .findFirst()
                .orElseThrow();
        assertThat(expiryNotification.getBody()).contains("임박");
        assertThat(expiryNotification.getMetadata()).containsEntry("count", 2);
        assertThat(expiryNotification.getMetadata()).containsEntry("batchDate", today.toString());
        assertThat(expiryNotification.isAllowBackground()).isTrue();

        List<NotificationDispatchLog> dispatchLogs = notificationDispatchLogRepository
                .findByNotification_Id(expiryNotification.getId());
        assertThat(dispatchLogs).isNotEmpty();
        assertThat(dispatchLogs.getFirst().getStatus()).isEqualTo(NotificationDispatchStatus.SUCCESS);

        // Deduplication check
        scheduler.runDailyBatch();
        List<Notification> afterSecondRun = notificationRepository.findAll();
        Map<String, Long> afterCounts = afterSecondRun.stream()
                .filter(notification -> notification.getUser().getId().equals(owner.getId()))
                .collect(Collectors.groupingBy(Notification::getKindCode, Collectors.counting()));
        assertThat(afterCounts.get(KIND_FRIDGE_EXPIRY)).isEqualTo(1L);
        assertThat(afterCounts.get(KIND_FRIDGE_EXPIRED)).isEqualTo(1L);
        String dateKey = FIXED_DATE.format(DateTimeFormatter.BASIC_ISO_DATE);
        String expectedExpiryKey = KIND_FRIDGE_EXPIRY + ":" + owner.getId() + ":" + dateKey;
        String expectedExpiredKey = KIND_FRIDGE_EXPIRED + ":" + owner.getId() + ":" + dateKey;
        assertThat(afterSecondRun.stream()
                .filter(notification -> notification.getUser().getId().equals(owner.getId()))
                .map(Notification::getDedupeKey)
                .collect(Collectors.toSet()))
                .contains(expectedExpiryKey, expectedExpiredKey);
    }

    @Test
    @Transactional
    void runDailyBatchLogsFailureWhenNotificationCreationThrows() {
        LocalDate today = FIXED_DATE;

        buildItem("치즈", today.plusDays(2));

        doThrow(new RuntimeException("Simulated failure"))
                .when(notificationService)
                .sendNotification(
                        any(UUID.class),
                        eq(KIND_FRIDGE_EXPIRY),
                        anyString(),
                        anyString(),
                        anyString(),
                        anyMap(),
                        anyInt(),
                        isNull()
                );

        try {
            scheduler.runDailyBatch();
        } finally {
            reset(notificationService);
        }

        List<NotificationDispatchLog> logs = notificationDispatchLogRepository.findAll();
        assertThat(logs).anySatisfy(log -> {
            assertThat(log.getStatus()).isEqualTo(NotificationDispatchStatus.FAILED);
            assertThat(log.getErrorCode()).isEqualTo("EXPIRY_BATCH_FAILED");
            assertThat(log.getErrorMessage()).contains("Simulated failure");
        });
    }

    @Test
    @Transactional
    void runDailyBatchDoesNotDispatchBackgroundWhenPreferenceDisabled() {
        LocalDate today = FIXED_DATE;
        buildItem("버터", today.plusDays(1));

        NotificationPreference preference = new NotificationPreference(
                new NotificationPreferenceId(owner.getId(), KIND_FRIDGE_EXPIRY),
                owner
        );
        preference.setEnabled(true);
        preference.setAllowBackground(false);
        notificationPreferenceRepository.save(preference);

        scheduler.runDailyBatch();

        Notification expiryNotification = notificationRepository.findAll().stream()
                .filter(notification -> notification.getKindCode().equals(KIND_FRIDGE_EXPIRY))
                .findFirst()
                .orElseThrow();
        assertThat(expiryNotification.isAllowBackground()).isFalse();
        List<NotificationDispatchLog> dispatchLogs = notificationDispatchLogRepository
                .findByNotification_Id(expiryNotification.getId());
        assertThat(dispatchLogs).isEmpty();
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

    private FridgeBundle createOwnerBundle() {
        FridgeCompartment compartment = fridgeCompartmentRepository.findById(slot2FAId)
                .orElseThrow(() -> new IllegalStateException("slot not found for scheduler test"));

        FridgeBundle bundle = new FridgeBundle();
        bundle.setOwner(owner);
        bundle.setFridgeCompartment(compartment);
        bundle.setBundleName("scheduler-test-bundle");
        bundle.setLabelNumber(nextLabelNumber(slot2FAId));
        return fridgeBundleRepository.save(bundle);
    }

    private int nextLabelNumber(UUID compartmentId) {
        Integer next = jdbcTemplate.queryForObject(
                """
                        SELECT COALESCE(MAX(label_number), 0) + 1
                        FROM fridge_bundle
                        WHERE fridge_compartment_id = ?
                        """,
                Integer.class,
                compartmentId
        );
        return next != null ? next : 1;
    }

    private void resetNotificationArtifacts() {
        notificationDispatchLogRepository.deleteAll();
        notificationRepository.deleteAll();
        notificationPreferenceRepository.deleteAll();
    }

    private void ensurePreferenceEnabled(String kindCode, boolean allowBackground) {
        NotificationPreferenceId prefId = new NotificationPreferenceId(owner.getId(), kindCode);
        NotificationPreference preference = notificationPreferenceRepository.findById(prefId)
                .orElseGet(() -> new NotificationPreference(prefId, owner));
        preference.setEnabled(true);
        preference.setAllowBackground(allowBackground);
        notificationPreferenceRepository.save(preference);
    }

    private UUID fetchSlotId(short floor, int slotIndex) {
        return jdbcTemplate.queryForObject(
                """
                        SELECT fc.id
                        FROM fridge_compartment fc
                        JOIN fridge_unit fu ON fu.id = fc.fridge_unit_id
                        WHERE fu.floor_no = ? AND fc.slot_index = ?
                        """,
                (rs, rowNum) -> UUID.fromString(rs.getString("id")),
                floor,
                slotIndex
        );
    }

    @TestConfiguration
    static class FixedClockConfig {
        @Bean
        @Primary
        Clock testClock() {
            Instant fixedInstant = FIXED_DATE.atStartOfDay().toInstant(ZoneOffset.UTC);
            return Clock.fixed(fixedInstant, ZoneOffset.UTC);
        }
    }
}

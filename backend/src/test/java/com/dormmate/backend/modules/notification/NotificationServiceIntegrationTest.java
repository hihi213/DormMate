package com.dormmate.backend.modules.notification;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import com.dormmate.backend.global.config.JpaConfig;
import com.dormmate.backend.global.common.time.TimeConfig;
import com.dormmate.backend.modules.notification.application.NotificationService;
import com.dormmate.backend.modules.auth.domain.DormUser;
import com.dormmate.backend.modules.auth.domain.DormUserStatus;
import com.dormmate.backend.modules.inspection.domain.InspectionAction;
import com.dormmate.backend.modules.inspection.domain.InspectionActionType;
import com.dormmate.backend.modules.inspection.domain.InspectionSession;
import com.dormmate.backend.modules.notification.domain.Notification;
import com.dormmate.backend.modules.notification.domain.NotificationPreference;
import com.dormmate.backend.modules.notification.domain.NotificationPreferenceId;
import com.dormmate.backend.modules.auth.infrastructure.persistence.DormUserRepository;
import com.dormmate.backend.modules.notification.infrastructure.persistence.NotificationPreferenceRepository;
import com.dormmate.backend.modules.notification.infrastructure.persistence.NotificationRepository;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Import;
import com.dormmate.backend.support.AbstractPostgresIntegrationTest;

@DataJpaTest(properties = {
        "spring.jpa.hibernate.ddl-auto=validate"
})
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Import({JpaConfig.class, TimeConfig.class, NotificationService.class})
class NotificationServiceIntegrationTest extends AbstractPostgresIntegrationTest {

    @Autowired
    private NotificationService notificationService;

    @Autowired
    private NotificationRepository notificationRepository;

    @Autowired
    private NotificationPreferenceRepository notificationPreferenceRepository;

    @Autowired
    private DormUserRepository dormUserRepository;

    private DormUser targetUser;

    @BeforeEach
    void setUp() {
        notificationPreferenceRepository.deleteAll();
        notificationRepository.deleteAll();

        String uniqueSuffix = UUID.randomUUID().toString();

        targetUser = new DormUser();
        targetUser.setLoginId("alice-" + uniqueSuffix);
        targetUser.setPasswordHash("hash");
        targetUser.setFullName("Alice");
        targetUser.setEmail("alice+" + uniqueSuffix + "@example.com");
        targetUser.setStatus(DormUserStatus.ACTIVE);
        targetUser = dormUserRepository.save(targetUser);
    }

    @Test
    @DisplayName("검사 결과 알림이 경고/폐기 대상 사용자에게 생성된다")
    void sendInspectionResultNotifications_createsNotification() {
        UUID sessionId = UUID.fromString("00000000-0000-0000-0000-000000000101");
        InspectionSession session = buildSession(sessionId,
                buildAction(InspectionActionType.WARN_INFO_MISMATCH),
                buildAction(InspectionActionType.DISPOSE_EXPIRED));

        notificationService.sendInspectionResultNotifications(session);

        List<Notification> notifications = notificationRepository.findAll();
        assertThat(notifications).hasSize(1);

        Notification saved = notifications.getFirst();
        assertThat(saved.getUser().getId()).isEqualTo(targetUser.getId());
        assertThat(saved.getMetadata()).containsEntry("sessionId", sessionId);
        assertThat(saved.getTtlAt()).isAfter(OffsetDateTime.now(ZoneOffset.UTC));

        // 중복 방지 확인
        notificationService.sendInspectionResultNotifications(session);
        assertThat(notificationRepository.count()).isEqualTo(1);
    }

    @Test
    @DisplayName("알림 수신이 비활성화된 사용자는 알림이 생성되지 않는다")
    void sendInspectionResultNotifications_respectsPreference() {
        NotificationPreference preference = new NotificationPreference(
                new NotificationPreferenceId(targetUser.getId(), "FRIDGE_RESULT"),
                targetUser
        );
        preference.setEnabled(false);
        notificationPreferenceRepository.save(preference);

        UUID sessionId = UUID.fromString("00000000-0000-0000-0000-000000000202");
        InspectionSession session = buildSession(sessionId, buildAction(InspectionActionType.WARN_STORAGE_POOR));

        notificationService.sendInspectionResultNotifications(session);

        Optional<Notification> notification = notificationRepository.findByUserIdAndDedupeKey(targetUser.getId(),
                "FRIDGE_RESULT:" + sessionId + ":" + targetUser.getId());
        assertThat(notification).isEmpty();
    }

    private InspectionSession buildSession(UUID id, InspectionAction... actions) {
        InspectionSession session = new InspectionSession();
        setField(session, "id", id);
        session.setStartedAt(OffsetDateTime.now(ZoneOffset.UTC));
        for (InspectionAction action : actions) {
            session.getActions().add(action);
            action.setInspectionSession(session);
        }
        return session;
    }

    private InspectionAction buildAction(InspectionActionType type) {
        InspectionAction action = new InspectionAction();
        action.setTargetUser(targetUser);
        action.setActionType(type);
        action.setRecordedAt(OffsetDateTime.now(ZoneOffset.UTC));
        return action;
    }

    private void setField(Object target, String fieldName, Object value) {
        try {
            java.lang.reflect.Field field = target.getClass().getDeclaredField(fieldName);
            field.setAccessible(true);
            field.set(target, value);
        } catch (ReflectiveOperationException ex) {
            throw new IllegalStateException(ex);
        }
    }
}

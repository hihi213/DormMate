package com.dormmate.backend.modules.notification;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.atLeast;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.dormmate.backend.modules.auth.domain.DormUser;
import com.dormmate.backend.modules.auth.domain.DormUserStatus;
import com.dormmate.backend.modules.auth.infrastructure.persistence.DormUserRepository;
import com.dormmate.backend.modules.inspection.domain.InspectionAction;
import com.dormmate.backend.modules.inspection.domain.InspectionActionType;
import com.dormmate.backend.modules.inspection.domain.InspectionSession;
import com.dormmate.backend.modules.notification.domain.Notification;
import com.dormmate.backend.modules.notification.application.NotificationService;
import com.dormmate.backend.modules.notification.domain.NotificationPreference;
import com.dormmate.backend.modules.notification.domain.NotificationPreferenceId;
import com.dormmate.backend.modules.notification.infrastructure.persistence.NotificationPreferenceRepository;
import com.dormmate.backend.modules.notification.infrastructure.persistence.NotificationRepository;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class NotificationServiceTest {

    @Mock
    private NotificationRepository notificationRepository;

    @Mock
    private NotificationPreferenceRepository notificationPreferenceRepository;

    @Mock
    private DormUserRepository dormUserRepository;

    private NotificationService notificationService;
    private Clock clock;

    private DormUser targetUser;

    @BeforeEach
    void setUp() {
        clock = Clock.fixed(OffsetDateTime.parse("2025-01-01T00:00:00Z").toInstant(), ZoneOffset.UTC);
        notificationService = new NotificationService(
                notificationRepository,
                notificationPreferenceRepository,
                dormUserRepository,
                clock
        );

        targetUser = new DormUser();
        targetUser.setLoginId("alice");
        targetUser.setPasswordHash("hash");
        targetUser.setFullName("Alice");
        targetUser.setEmail("alice@example.com");
        targetUser.setStatus(DormUserStatus.ACTIVE);
        // 직접 ID를 부여해 사용
        java.lang.reflect.Field idField;
        try {
            idField = DormUser.class.getDeclaredField("id");
            idField.setAccessible(true);
            idField.set(targetUser, UUID.fromString("00000000-0000-0000-0000-000000000101"));
        } catch (ReflectiveOperationException ex) {
            throw new IllegalStateException(ex);
        }

        lenient().when(notificationPreferenceRepository.findById(any(NotificationPreferenceId.class)))
                .thenReturn(Optional.empty());
        lenient().when(dormUserRepository.findActiveAdminIds()).thenReturn(List.of());
        lenient().when(dormUserRepository.existsActiveAdminRole(any())).thenReturn(false);
    }

    @Test
    @DisplayName("검사 결과 알림이 경고/폐기 대상 사용자에게 생성된다")
    void sendInspectionResultNotifications_createsNotification() {
        UUID sessionId = UUID.fromString("00000000-0000-0000-0000-000000000501");
        InspectionSession session = buildSession(sessionId,
                buildAction(InspectionActionType.WARN_INFO_MISMATCH),
                buildAction(InspectionActionType.DISPOSE_EXPIRED));

        when(notificationPreferenceRepository.findById(any(NotificationPreferenceId.class)))
                .thenReturn(Optional.empty());
        when(notificationRepository.findByUserIdAndDedupeKey(eq(targetUser.getId()), any()))
                .thenReturn(Optional.empty());

        notificationService.sendInspectionResultNotifications(session);

        ArgumentCaptor<Notification> captor = ArgumentCaptor.forClass(Notification.class);
        verify(notificationRepository).save(captor.capture());

        Notification saved = captor.getValue();
        assertThat(saved.getUser().getId()).isEqualTo(targetUser.getId());
        assertThat(saved.getTitle()).contains("검사 결과");
        assertThat(saved.getBody()).contains("경고 1건").contains("폐기 1건");
        assertThat(saved.getCorrelationId()).isEqualTo(sessionId);
        assertThat(saved.getMetadata()).containsEntry("sessionId", sessionId);
        assertThat(saved.getMetadata()).containsEntry("actionIds", java.util.List.of());
        assertThat(saved.getMetadata()).containsEntry("actionItemIds", java.util.List.of());
        assertThat(saved.getMetadata()).containsEntry("penaltyHistoryIds", java.util.List.of());
        assertThat(saved.getTtlAt()).isAfter(OffsetDateTime.now(clock));
        assertThat(saved.isAllowBackground()).isTrue();
    }

    @Test
    @DisplayName("알림 수신이 비활성화된 사용자는 알림을 생성하지 않는다")
    void sendInspectionResultNotifications_skipsWhenDisabled() {
        NotificationPreference preference = new NotificationPreference(
                new NotificationPreferenceId(targetUser.getId(), "FRIDGE_RESULT"),
                targetUser
        );
        preference.setEnabled(false);

        when(notificationPreferenceRepository.findById(any(NotificationPreferenceId.class)))
                .thenReturn(Optional.of(preference));

        UUID sessionId = UUID.fromString("00000000-0000-0000-0000-000000000777");
        InspectionSession session = buildSession(sessionId, buildAction(InspectionActionType.WARN_STORAGE_POOR));

        notificationService.sendInspectionResultNotifications(session);

        verify(notificationRepository, never()).save(any());
    }

    @Test
    @DisplayName("알림 기본 선호에는 검사/임박/만료 종류가 포함된다")
    void getPreferencesIncludesAllKindsWithDefaults() {
        UUID userId = UUID.fromString("00000000-0000-0000-0000-000000000303");
        when(notificationPreferenceRepository.findByIdUserId(userId)).thenReturn(List.of());
        when(dormUserRepository.existsActiveAdminRole(userId)).thenReturn(false);

        NotificationService.NotificationPreferenceView view = notificationService.getPreferences(userId);

        assertThat(view.items()).extracting(NotificationService.NotificationPreferenceItem::kindCode)
                .containsExactlyInAnyOrder(
                        "FRIDGE_RESULT",
                        NotificationService.KIND_FRIDGE_SCHEDULE,
                        NotificationService.KIND_FRIDGE_EXPIRY,
                        NotificationService.KIND_FRIDGE_EXPIRED
                );

        NotificationService.NotificationPreferenceItem schedulePref = view.items().stream()
                .filter(item -> item.kindCode().equals(NotificationService.KIND_FRIDGE_SCHEDULE))
                .findFirst()
                .orElseThrow();
        assertThat(schedulePref.enabled()).isTrue();
        assertThat(schedulePref.allowBackground()).isTrue();

        NotificationService.NotificationPreferenceItem expiryPref = view.items().stream()
                .filter(item -> item.kindCode().equals(NotificationService.KIND_FRIDGE_EXPIRY))
                .findFirst()
                .orElseThrow();
        assertThat(expiryPref.enabled()).isTrue();
        assertThat(expiryPref.allowBackground()).isFalse();

        NotificationService.NotificationPreferenceItem expiredPref = view.items().stream()
                .filter(item -> item.kindCode().equals(NotificationService.KIND_FRIDGE_EXPIRED))
                .findFirst()
                .orElseThrow();
        assertThat(expiredPref.enabled()).isTrue();
        assertThat(expiredPref.allowBackground()).isTrue();
    }

    @Test
    @DisplayName("관리자는 검사 조치 보고 알림 선호만 노출된다")
    void adminPreferencesIncludeAdminKindOnly() {
        UUID adminId = UUID.fromString("00000000-0000-0000-0000-000000000909");
        when(notificationPreferenceRepository.findByIdUserId(adminId)).thenReturn(List.of());
        when(dormUserRepository.existsActiveAdminRole(adminId)).thenReturn(true);

        NotificationService.NotificationPreferenceView view = notificationService.getPreferences(adminId);

        assertThat(view.items())
                .extracting(NotificationService.NotificationPreferenceItem::kindCode)
                .containsExactly(NotificationService.KIND_FRIDGE_RESULT_ADMIN);
    }

    @Test
    @DisplayName("경고나 폐기 조치가 있으면 관리자도 알림을 받는다")
    void sendInspectionResultNotifications_notifiesAdmins() {
        UUID sessionId = UUID.fromString("00000000-0000-0000-0000-000000000888");
        InspectionSession session = buildSession(sessionId,
                buildAction(InspectionActionType.WARN_INFO_MISMATCH),
                buildAction(InspectionActionType.DISPOSE_EXPIRED));

        UUID adminId = UUID.fromString("00000000-0000-0000-0000-000000000707");
        DormUser adminUser = new DormUser();
        adminUser.setStatus(DormUserStatus.ACTIVE);
        setField(adminUser, "id", adminId);

        when(dormUserRepository.findActiveAdminIds()).thenReturn(List.of(adminId));
        when(dormUserRepository.findById(adminId)).thenReturn(Optional.of(adminUser));
        when(dormUserRepository.existsActiveAdminRole(adminId)).thenReturn(true);

        notificationService.sendInspectionResultNotifications(session);

        ArgumentCaptor<Notification> captor = ArgumentCaptor.forClass(Notification.class);
        verify(notificationRepository, atLeast(2)).save(captor.capture());
        assertThat(captor.getAllValues())
                .anyMatch(notification -> notification.getKindCode().equals(NotificationService.KIND_FRIDGE_RESULT_ADMIN));
    }

    private InspectionSession buildSession(UUID id, InspectionAction... actions) {
        InspectionSession session = new InspectionSession();
        setField(session, "id", id);
        session.setStartedAt(OffsetDateTime.now(clock));
        for (InspectionAction action : actions) {
            session.getActions().add(action);
            action.setInspectionSession(session);
        }
        return session;
    }

    private InspectionAction buildAction(InspectionActionType type) {
        InspectionAction action = new InspectionAction();
        action.setActionType(type);
        action.setRecordedAt(OffsetDateTime.now(clock));
        action.setTargetUser(targetUser);
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

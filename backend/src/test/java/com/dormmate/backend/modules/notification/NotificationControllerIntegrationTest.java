package com.dormmate.backend.modules.notification;

import static com.dormmate.backend.support.TestResidentAccounts.DEFAULT_PASSWORD;
import static com.dormmate.backend.support.TestResidentAccounts.FLOOR2_ROOM05_SLOT1;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.dormmate.backend.modules.auth.domain.DormUser;
import com.dormmate.backend.modules.auth.infrastructure.persistence.DormUserRepository;
import com.dormmate.backend.modules.notification.domain.Notification;
import com.dormmate.backend.modules.notification.domain.NotificationState;
import com.dormmate.backend.modules.notification.infrastructure.persistence.NotificationPreferenceRepository;
import com.dormmate.backend.modules.notification.infrastructure.persistence.NotificationRepository;
import com.dormmate.backend.support.AbstractPostgresIntegrationTest;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

@SpringBootTest
@AutoConfigureMockMvc
class NotificationControllerIntegrationTest extends AbstractPostgresIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private NotificationRepository notificationRepository;

    @Autowired
    private NotificationPreferenceRepository notificationPreferenceRepository;

    @Autowired
    private DormUserRepository dormUserRepository;

    private DormUser resident;
    private String residentToken;

    @BeforeEach
    void setUp() throws Exception {
        resident = dormUserRepository.findByLoginIdIgnoreCase(FLOOR2_ROOM05_SLOT1)
                .orElseThrow(() -> new IllegalStateException("primary resident user not found"));
        residentToken = loginAndGetAccessToken(FLOOR2_ROOM05_SLOT1, DEFAULT_PASSWORD);
    }

    @AfterEach
    void tearDown() {
        notificationRepository.deleteAll();
        notificationPreferenceRepository.deleteAll();
    }

    @Test
    void listNotificationsReturnsUnreadFirstAndSkipsExpired() throws Exception {
        Notification unread1 = createNotification(NotificationState.UNREAD, OffsetDateTime.now().plusDays(1));
        Notification unread2 = createNotification(NotificationState.UNREAD, OffsetDateTime.now().plusDays(1));
        Notification read = createNotification(NotificationState.READ, OffsetDateTime.now().plusDays(1));
        read.setReadAt(OffsetDateTime.now().minusHours(1));
        notificationRepository.save(read);
        Notification expired = createNotification(NotificationState.UNREAD, OffsetDateTime.now().minusHours(1));
        notificationRepository.saveAll(List.of(unread1, unread2, expired));

        MvcResult result = mockMvc.perform(
                        get("/notifications")
                                .header("Authorization", "Bearer " + residentToken)
                )
                .andExpect(status().isOk())
                .andReturn();

        JsonNode response = objectMapper.readTree(result.getResponse().getContentAsString());
        JsonNode items = response.path("items");
        assertThat(items).hasSize(3);
        assertThat(items.get(0).path("state").asText()).isEqualTo("UNREAD");
        assertThat(response.path("unreadCount").asLong()).isEqualTo(2);

        Optional<Notification> expiredStored = notificationRepository.findById(expired.getId());
        assertThat(expiredStored).isPresent();
        assertThat(expiredStored.get().getState()).isEqualTo(NotificationState.EXPIRED);
    }

    @Test
    void markNotificationReadUpdatesState() throws Exception {
        Notification unread = createNotification(NotificationState.UNREAD, OffsetDateTime.now().plusDays(1));
        notificationRepository.save(unread);

        mockMvc.perform(
                        patch("/notifications/{id}/read", unread.getId())
                                .header("Authorization", "Bearer " + residentToken)
                )
                .andExpect(status().isNoContent());

        Notification updated = notificationRepository.findById(unread.getId()).orElseThrow();
        assertThat(updated.getState()).isEqualTo(NotificationState.READ);
        assertThat(updated.getReadAt()).isNotNull();
    }

    @Test
    void markAllNotificationsReadUpdatesUnreadCount() throws Exception {
        notificationRepository.save(createNotification(NotificationState.UNREAD, OffsetDateTime.now().plusDays(1)));
        notificationRepository.save(createNotification(NotificationState.UNREAD, OffsetDateTime.now().plusDays(1)));

        mockMvc.perform(
                        patch("/notifications/read-all")
                                .header("Authorization", "Bearer " + residentToken)
                )
                .andExpect(status().isNoContent());

        List<Notification> all = notificationRepository.findAll();
        assertThat(all).allMatch(notification -> notification.getState() == NotificationState.READ);
    }

    @Test
    void getPreferencesReturnsDefaults() throws Exception {
        MvcResult result = mockMvc.perform(
                        get("/notifications/preferences")
                                .header("Authorization", "Bearer " + residentToken)
                )
                .andExpect(status().isOk())
                .andReturn();

        JsonNode response = objectMapper.readTree(result.getResponse().getContentAsString());
        JsonNode items = response.path("items");
        assertThat(items.isArray()).isTrue();
        assertThat(items.size()).isGreaterThanOrEqualTo(1);
        JsonNode first = items.get(0);
        assertThat(first.path("kindCode").asText()).isEqualTo("FRIDGE_RESULT");
        assertThat(first.path("enabled").asBoolean()).isTrue();
        assertThat(first.path("allowBackground").asBoolean()).isTrue();
    }

    @Test
    void updatePreferenceOverwritesValues() throws Exception {
        ObjectNode body = objectMapper.createObjectNode();
        body.put("enabled", false);
        body.put("allowBackground", false);

        mockMvc.perform(
                        patch("/notifications/preferences/{kind}", "FRIDGE_RESULT")
                                .header("Authorization", "Bearer " + residentToken)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(body.toString())
                )
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.enabled").value(false))
                .andExpect(jsonPath("$.allowBackground").value(false));
    }

    @Test
    void invalidStateParameterReturnsBadRequest() throws Exception {
        mockMvc.perform(
                        get("/notifications")
                                .header("Authorization", "Bearer " + residentToken)
                                .param("state", "invalid")
                )
                .andExpect(status().isBadRequest());
    }

    private Notification createNotification(NotificationState state, OffsetDateTime ttlAt) {
        Notification notification = new Notification();
        notification.setUser(resident);
        notification.setKindCode("FRIDGE_RESULT");
        notification.setTitle("테스트 알림");
        notification.setBody("본문");
        notification.setState(state);
        notification.setDedupeKey("test:" + UUID.randomUUID());
        notification.setTtlAt(ttlAt);
        notification.setCorrelationId(UUID.randomUUID());
        notification.setMetadata(Map.of("source", "test"));
        if (state == NotificationState.READ) {
            notification.setReadAt(OffsetDateTime.now().minusHours(2));
        }
        return notification;
    }

    private String loginAndGetAccessToken(String loginId, String password) throws Exception {
        String deviceId = loginId + "-device";
        MvcResult result = mockMvc.perform(
                        post("/auth/login")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("""
                                        {
                                          "loginId": "%s",
                                          "password": "%s",
                                          "deviceId": "%s"
                                        }
                                        """.formatted(loginId, password, deviceId))
                )
                .andExpect(status().isOk())
                .andReturn();

        JsonNode response = objectMapper.readTree(result.getResponse().getContentAsString());
        return response.path("tokens").path("accessToken").asText();
    }
}

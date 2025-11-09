package com.dormmate.backend.modules.inspection;

import static com.dormmate.backend.support.TestResidentAccounts.DEFAULT_PASSWORD;
import static com.dormmate.backend.support.TestResidentAccounts.FLOOR2_ROOM05_SLOT1;
import static com.dormmate.backend.support.TestResidentAccounts.FLOOR2_ROOM05_SLOT3;
import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.dormmate.backend.modules.fridge.domain.FridgeItemStatus;
import com.dormmate.backend.modules.fridge.infrastructure.persistence.FridgeBundleRepository;
import com.dormmate.backend.modules.fridge.infrastructure.persistence.FridgeItemRepository;
import com.dormmate.backend.modules.inspection.application.InspectionService;
import com.dormmate.backend.modules.inspection.domain.InspectionScheduleStatus;
import com.dormmate.backend.modules.inspection.domain.InspectionStatus;
import com.dormmate.backend.support.AbstractPostgresIntegrationTest;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.time.Duration;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

@SpringBootTest
@AutoConfigureMockMvc
class InspectionIntegrationTest extends AbstractPostgresIntegrationTest {

    private static final int FLOOR_2 = 2;
    private static final int SLOT_INDEX_A = 0;

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private FridgeBundleRepository fridgeBundleRepository;

    @Autowired
    private FridgeItemRepository fridgeItemRepository;

    @Autowired
    private InspectionService inspectionService;

    private String managerToken;
    private String residentToken;
    private String adminToken;
    private List<UUID> bundlesToCleanup;
    private UUID slot2FAId;
    private UUID residentId;
    private UUID residentRoomId;

    @BeforeEach
    void setUp() throws Exception {
        bundlesToCleanup = new ArrayList<>();
        managerToken = login(FLOOR2_ROOM05_SLOT3, DEFAULT_PASSWORD);
        residentToken = login(FLOOR2_ROOM05_SLOT1, DEFAULT_PASSWORD);
        adminToken = login("dormmate", "admin1!");
        slot2FAId = fetchSlotId(FLOOR_2, SLOT_INDEX_A);
        residentId = fetchUserId(FLOOR2_ROOM05_SLOT1);
        residentRoomId = ensureResidentAssignment(residentId);
        ensureCompartmentAccess(residentRoomId, slot2FAId);

        jdbcTemplate.update("DELETE FROM inspection_schedule");
        jdbcTemplate.update("DELETE FROM inspection_action_item");
        jdbcTemplate.update("DELETE FROM inspection_action");
        jdbcTemplate.update("DELETE FROM inspection_participant");
        jdbcTemplate.update("DELETE FROM inspection_session");
        jdbcTemplate.update("UPDATE fridge_item SET status = 'ACTIVE', deleted_at = NULL");
        jdbcTemplate.update("UPDATE fridge_bundle SET status = 'ACTIVE', deleted_at = NULL");
        jdbcTemplate.update("UPDATE fridge_compartment SET is_locked = FALSE, locked_until = NULL");

        clearSlot(slot2FAId);
    }

    @Test
    void adminReceivesForbiddenForInspectionLifecycle() throws Exception {
        JsonNode bundle = ensureBundleForPrimaryResident(slot2FAId);
        UUID bundleId = UUID.fromString(bundle.path("bundleId").asText());
        UUID itemId = UUID.fromString(bundle.path("items").get(0).path("itemId").asText());

        mockMvc.perform(post("/fridge/inspections")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "slotId": "%s"
                                }
                                """.formatted(slot2FAId)))
                .andExpect(status().isForbidden());

        JsonNode session = startInspection(managerToken, slot2FAId);
        UUID sessionId = UUID.fromString(session.path("sessionId").asText());

        mockMvc.perform(post("/fridge/inspections/%s/actions".formatted(sessionId))
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "actions": [
                                    {
                                      "action": "DISPOSE_EXPIRED",
                                      "bundleId": "%s",
                                      "itemId": "%s"
                                    }
                                  ]
                                }
                                """.formatted(bundleId, itemId)))
                .andExpect(status().isForbidden());

        mockMvc.perform(post("/fridge/inspections/%s/submit".formatted(sessionId))
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isForbidden());

        mockMvc.perform(delete("/fridge/inspections/%s".formatted(sessionId))
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isNoContent());
    }

    @AfterEach
    void tearDown() {
        jdbcTemplate.update("DELETE FROM inspection_action_item");
        jdbcTemplate.update("DELETE FROM inspection_action");
        jdbcTemplate.update("DELETE FROM inspection_participant");
        jdbcTemplate.update("DELETE FROM inspection_schedule");
        jdbcTemplate.update("DELETE FROM inspection_session");
        bundlesToCleanup.forEach(id -> fridgeBundleRepository.findById(id)
                .ifPresent(fridgeBundleRepository::delete));
    }

    @Test
    void managerCanRunFullInspectionHappyPath() throws Exception {
        JsonNode bundle = ensureBundleForPrimaryResident(slot2FAId);
        UUID bundleId = UUID.fromString(bundle.path("bundleId").asText());
        UUID itemId = UUID.fromString(bundle.path("items").get(0).path("itemId").asText());

        JsonNode session = startInspection(managerToken, slot2FAId);
        UUID sessionId = UUID.fromString(session.path("sessionId").asText());

        recordDisposeAction(managerToken, sessionId, bundleId, itemId);

        JsonNode submitted = submitInspection(managerToken, sessionId);
        assertThat(submitted.path("status").asText()).isEqualTo(InspectionStatus.SUBMITTED.name());

        fridgeItemRepository.findById(itemId).ifPresent(item -> {
            assertThat(item.getStatus()).isEqualTo(FridgeItemStatus.DELETED);
            assertThat(item.getDeletedAt()).isNotNull();
        });

        mockMvc.perform(get("/fridge/inspections/" + sessionId)
                        .header("Authorization", "Bearer " + managerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value(InspectionStatus.SUBMITTED.name()))
                .andExpect(jsonPath("$.summary[0].count").value(1));
    }

    @Test
    void residentCannotStartInspection() throws Exception {
        mockMvc.perform(post("/fridge/inspections")
                        .header("Authorization", "Bearer " + residentToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "slotId": "%s"
                                }
                                """.formatted(slot2FAId)))
                .andExpect(status().isForbidden());
    }

    @Test
    void lockIsExtendedWhenActionsAreRecorded() throws Exception {
        JsonNode bundle = ensureBundleForPrimaryResident(slot2FAId);
        UUID bundleId = UUID.fromString(bundle.path("bundleId").asText());
        UUID itemId = UUID.fromString(bundle.path("items").get(0).path("itemId").asText());

        JsonNode session = startInspection(managerToken, slot2FAId);
        UUID sessionId = UUID.fromString(session.path("sessionId").asText());

        OffsetDateTime initialLockedUntil = jdbcTemplate.queryForObject(
                "SELECT locked_until FROM fridge_compartment WHERE id = ?",
                OffsetDateTime.class,
                slot2FAId
        );

        assertThat(initialLockedUntil).isNotNull();
        Duration initialDuration = Duration.between(OffsetDateTime.now(ZoneOffset.UTC), initialLockedUntil);
        assertThat(initialDuration.toMinutes()).isGreaterThanOrEqualTo(25);

        recordDisposeAction(managerToken, sessionId, bundleId, itemId);

        OffsetDateTime extendedLockedUntil = jdbcTemplate.queryForObject(
                "SELECT locked_until FROM fridge_compartment WHERE id = ?",
                OffsetDateTime.class,
                slot2FAId
        );

        assertThat(extendedLockedUntil).isNotNull();
        assertThat(extendedLockedUntil).isAfter(initialLockedUntil);
    }

    @Test
    void expiredLocksAreReleasedByMaintenance() throws Exception {
        JsonNode session = startInspection(managerToken, slot2FAId);
        UUID sessionId = UUID.fromString(session.path("sessionId").asText());

        OffsetDateTime past = OffsetDateTime.now(ZoneOffset.UTC).minusMinutes(10);
        jdbcTemplate.update("UPDATE fridge_compartment SET locked_until = ?, is_locked = TRUE WHERE id = ?",
                past,
                slot2FAId);

        jdbcTemplate.update("UPDATE inspection_session SET started_at = ?, status = 'IN_PROGRESS' WHERE id = ?",
                past,
                sessionId);

        int released = inspectionService.releaseExpiredSessions();
        assertThat(released).isGreaterThanOrEqualTo(1);

        Boolean locked = jdbcTemplate.queryForObject(
                "SELECT is_locked FROM fridge_compartment WHERE id = ?",
                Boolean.class,
                slot2FAId
        );
        assertThat(locked).isFalse();

        OffsetDateTime sessionEndedAt = jdbcTemplate.queryForObject(
                "SELECT ended_at FROM inspection_session WHERE id = ?",
                OffsetDateTime.class,
                sessionId
        );
        String sessionStatus = jdbcTemplate.queryForObject(
                "SELECT status FROM inspection_session WHERE id = ?",
                String.class,
                sessionId
        );
        assertThat(sessionStatus).isEqualTo(InspectionStatus.CANCELLED.name());
        assertThat(sessionEndedAt).isNotNull();
    }

    @Test
    void residentCanViewOwnInspectionSession() throws Exception {
        JsonNode bundle = ensureBundleForPrimaryResident(slot2FAId);
        UUID bundleId = UUID.fromString(bundle.path("bundleId").asText());
        UUID itemId = UUID.fromString(bundle.path("items").get(0).path("itemId").asText());

        JsonNode session = startInspection(managerToken, slot2FAId);
        UUID sessionId = UUID.fromString(session.path("sessionId").asText());

        recordDisposeAction(managerToken, sessionId, bundleId, itemId);

        mockMvc.perform(get("/fridge/inspections/" + sessionId)
                        .header("Authorization", "Bearer " + residentToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.slotId").value(slot2FAId.toString()))
                .andExpect(jsonPath("$.summary[0].count").value(1));

        mockMvc.perform(get("/fridge/inspections")
                        .header("Authorization", "Bearer " + residentToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].sessionId", hasItem(sessionId.toString())));
    }

    @Test
    void residentCannotViewOtherCompartmentInspection() throws Exception {
        UUID otherSlotId = fetchSlotId(FLOOR_2, 1);
        JsonNode otherSession = startInspection(managerToken, otherSlotId);
        UUID otherSessionId = UUID.fromString(otherSession.path("sessionId").asText());

        mockMvc.perform(get("/fridge/inspections/" + otherSessionId)
                        .header("Authorization", "Bearer " + residentToken))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN_SLOT"));

        mockMvc.perform(get("/fridge/inspections")
                        .header("Authorization", "Bearer " + residentToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].sessionId", not(hasItem(otherSessionId.toString()))));
    }

    @Test
    void residentCanViewSubmittedInspectionHistoryWithFilter() throws Exception {
        JsonNode bundle = ensureBundleForPrimaryResident(slot2FAId);
        UUID bundleId = UUID.fromString(bundle.path("bundleId").asText());
        UUID itemId = UUID.fromString(bundle.path("items").get(0).path("itemId").asText());

        JsonNode session = startInspection(managerToken, slot2FAId);
        UUID sessionId = UUID.fromString(session.path("sessionId").asText());
        recordDisposeAction(managerToken, sessionId, bundleId, itemId);
        submitInspection(managerToken, sessionId);

        mockMvc.perform(get("/fridge/inspections")
                        .param("status", InspectionStatus.SUBMITTED.name())
                        .param("limit", "5")
                        .header("Authorization", "Bearer " + residentToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].sessionId", hasItem(sessionId.toString())));
    }

    @Test
    void adminInspectionListingIncludesInspectorAndTargetMetadata() throws Exception {
        JsonNode bundle = ensureBundleForPrimaryResident(slot2FAId);
        UUID bundleId = UUID.fromString(bundle.path("bundleId").asText());
        UUID itemId = UUID.fromString(bundle.path("items").get(0).path("itemId").asText());

        JsonNode session = startInspection(managerToken, slot2FAId);
        UUID sessionId = UUID.fromString(session.path("sessionId").asText());

        recordDisposeAction(managerToken, sessionId, bundleId, itemId);
        submitInspection(managerToken, sessionId);

        JsonNode inspections = listInspections(adminToken, slot2FAId);
        assertThat(inspections.isArray()).isTrue();
        assertThat(inspections).isNotEmpty();

        JsonNode latest = inspections.get(0);
        assertThat(latest.path("startedByLogin").asText()).isEqualTo(FLOOR2_ROOM05_SLOT3);
        assertThat(latest.path("startedByName").asText()).isNotBlank();

        JsonNode firstAction = latest.path("actions").get(0);
        assertThat(firstAction.path("targetName").asText()).isNotBlank();
        String expectedRoom = jdbcTemplate.queryForObject(
                "SELECT room_number FROM room WHERE id = ?",
                String.class,
                residentRoomId
        );
        Integer expectedPersonal = jdbcTemplate.queryForObject(
                "SELECT personal_no FROM room_assignment WHERE dorm_user_id = ? AND released_at IS NULL",
                Integer.class,
                residentId
        );
        assertThat(firstAction.path("roomNumber").asText()).isEqualTo(expectedRoom);
        assertThat(firstAction.path("personalNo").asInt()).isEqualTo(expectedPersonal);
    }

    @Test
    void managerCannotSubmitTwice() throws Exception {
        JsonNode session = startInspection(managerToken, slot2FAId);
        UUID sessionId = UUID.fromString(session.path("sessionId").asText());

        submitInspection(managerToken, sessionId);

        mockMvc.perform(post("/fridge/inspections/%s/submit".formatted(sessionId))
                        .header("Authorization", "Bearer " + managerToken))
                .andExpect(status().isConflict());
    }

    @Test
    void managerCannotStartWhenSessionExists() throws Exception {
        startInspection(managerToken, slot2FAId);

        mockMvc.perform(post("/fridge/inspections")
                        .header("Authorization", "Bearer " + managerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "slotId": "%s"
                                }
                                """.formatted(slot2FAId)))
                .andExpect(status().isConflict());
    }

    @Test
    void scheduleLinkedInspectionCompletesAutomatically() throws Exception {
        OffsetDateTime scheduledAt = OffsetDateTime.now(ZoneOffset.UTC).plusDays(1).withNano(0);
        MvcResult scheduleResult = mockMvc.perform(post("/fridge/inspection-schedules")
                        .header("Authorization", "Bearer " + managerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "scheduledAt": "%s",
                                  "title": "층별 정기 점검",
                                  "fridgeCompartmentId": "%s"
                                }
                                """.formatted(scheduledAt, slot2FAId)))
                .andExpect(status().isCreated())
                .andReturn();
        JsonNode createdSchedule = objectMapper.readTree(scheduleResult.getResponse().getContentAsString());
        assertThat(createdSchedule.path("fridgeCompartmentId").asText()).isEqualTo(slot2FAId.toString());
        UUID scheduleId = UUID.fromString(createdSchedule.path("scheduleId").asText());

        JsonNode session = startInspection(managerToken, slot2FAId, scheduleId);
        UUID sessionId = UUID.fromString(session.path("sessionId").asText());

        UUID linkedSessionId = jdbcTemplate.queryForObject(
                "SELECT inspection_session_id FROM inspection_schedule WHERE id = ?",
                (rs, rowNum) -> rs.getString("inspection_session_id") != null ? UUID.fromString(rs.getString("inspection_session_id")) : null,
                scheduleId
        );
        assertThat(linkedSessionId).isEqualTo(sessionId);

        submitInspection(managerToken, sessionId);

        String status = jdbcTemplate.queryForObject(
                "SELECT status FROM inspection_schedule WHERE id = ?",
                String.class,
                scheduleId
        );
        OffsetDateTime completedAt = jdbcTemplate.queryForObject(
                "SELECT completed_at FROM inspection_schedule WHERE id = ?",
                OffsetDateTime.class,
                scheduleId
        );

        assertThat(status).isEqualTo(InspectionScheduleStatus.COMPLETED.name());
        assertThat(completedAt).isNotNull();
    }

    @Test
    void cancelInspectionReleasesSchedule() throws Exception {
        OffsetDateTime scheduledAt = OffsetDateTime.now(ZoneOffset.UTC).plusDays(2).withNano(0);
        MvcResult scheduleResult = mockMvc.perform(post("/fridge/inspection-schedules")
                        .header("Authorization", "Bearer " + managerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "scheduledAt": "%s",
                                  "title": "취소 테스트 일정",
                                  "fridgeCompartmentId": "%s"
                                }
                                """.formatted(scheduledAt, slot2FAId)))
                .andExpect(status().isCreated())
                .andReturn();
        JsonNode createdSchedule = objectMapper.readTree(scheduleResult.getResponse().getContentAsString());
        assertThat(createdSchedule.path("fridgeCompartmentId").asText()).isEqualTo(slot2FAId.toString());
        UUID scheduleId = UUID.fromString(createdSchedule.path("scheduleId").asText());

        JsonNode session = startInspection(managerToken, slot2FAId, scheduleId);
        UUID sessionId = UUID.fromString(session.path("sessionId").asText());

        mockMvc.perform(delete("/fridge/inspections/%s".formatted(sessionId))
                        .header("Authorization", "Bearer " + managerToken))
                .andExpect(status().isNoContent());

        String status = jdbcTemplate.queryForObject(
                "SELECT status FROM inspection_schedule WHERE id = ?",
                String.class,
                scheduleId
        );
        OffsetDateTime completedAt = jdbcTemplate.queryForObject(
                "SELECT completed_at FROM inspection_schedule WHERE id = ?",
                OffsetDateTime.class,
                scheduleId
        );
        String linkedSession = jdbcTemplate.queryForObject(
                "SELECT inspection_session_id FROM inspection_schedule WHERE id = ?",
                String.class,
                scheduleId
        );

        assertThat(status).isEqualTo(InspectionScheduleStatus.SCHEDULED.name());
        assertThat(completedAt).isNull();
        assertThat(linkedSession).isNull();
    }

    private JsonNode startInspection(String token, UUID slotId) throws Exception {
        return startInspection(token, slotId, null);
    }

    private JsonNode startInspection(String token, UUID slotId, UUID scheduleId) throws Exception {
        String payload;
        if (scheduleId != null) {
            payload = """
                    {
                      "slotId": "%s",
                      "scheduleId": "%s"
                    }
                    """.formatted(slotId, scheduleId);
        } else {
            payload = """
                    {
                      "slotId": "%s"
                    }
                    """.formatted(slotId);
        }
        MvcResult result = mockMvc.perform(post("/fridge/inspections")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.sessionId").isNotEmpty())
                .andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString());
    }

    private JsonNode submitInspection(String token, UUID sessionId) throws Exception {
        MvcResult result = mockMvc.perform(post("/fridge/inspections/%s/submit".formatted(sessionId))
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString());
    }

    private JsonNode listInspections(String token, UUID slotId) throws Exception {
        MvcResult result = mockMvc.perform(get("/fridge/inspections")
                        .header("Authorization", "Bearer " + token)
                        .param("slotId", slotId.toString()))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString());
    }

    private void recordDisposeAction(String token, UUID sessionId, UUID bundleId, UUID itemId) throws Exception {
        mockMvc.perform(post("/fridge/inspections/%s/actions".formatted(sessionId))
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                .content("""
                                {
                                  "actions": [
                                    {
                                      "action": "DISPOSE_EXPIRED",
                                      "bundleId": "%s",
                                      "itemId": "%s",
                                      "note": "테스트 폐기"
                                    }
                                  ]
                                }
                                """.formatted(bundleId, itemId)))
                .andExpect(status().isOk());
    }

    private JsonNode ensureBundleForPrimaryResident(UUID slotId) throws Exception {
        clearSlot(slotId);
        return createBundleForPrimaryResident(slotId);
    }

    private JsonNode createBundleForPrimaryResident(UUID slotId) throws Exception {
        String expiresOn = LocalDate.now(ZoneOffset.UTC).plusDays(2).toString();
        MvcResult result = mockMvc.perform(post("/fridge/bundles")
                        .header("Authorization", "Bearer " + residentToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "slotId": "%s",
                                  "bundleName": "Inspection 테스트 포장",
                                  "items": [
                                    {
                                      "name": "테스트 식품",
                                      "expiryDate": "%s",
                                      "quantity": 1
                                    }
                                  ]
                                }
                                """.formatted(slotId, expiresOn)))
                .andExpect(status().isCreated())
                .andReturn();

        JsonNode bundle = objectMapper.readTree(result.getResponse().getContentAsString()).path("bundle");
        bundlesToCleanup.add(UUID.fromString(bundle.path("bundleId").asText()));
        return bundle;
    }

    private UUID ensureResidentAssignment(UUID userId) {
        UUID roomId = fetchRoomId(2, "01");
        jdbcTemplate.update("UPDATE room_assignment SET released_at = NOW(), updated_at = NOW() WHERE dorm_user_id = ?", userId);
        jdbcTemplate.update("UPDATE room_assignment SET released_at = NOW(), updated_at = NOW() WHERE room_id = ?", roomId);
        jdbcTemplate.update(
                """
                        INSERT INTO room_assignment (id, room_id, dorm_user_id, personal_no, assigned_at, released_at, created_at, updated_at)
                        VALUES (?, ?, ?, ?, NOW(), NULL, NOW(), NOW())
                        """,
                UUID.randomUUID(),
                roomId,
                userId,
                1
        );
        return roomId;
    }

    private void ensureCompartmentAccess(UUID roomId, UUID compartmentId) {
        Integer existing = jdbcTemplate.queryForObject(
                """
                        SELECT COUNT(*) FROM compartment_room_access
                        WHERE room_id = ? AND fridge_compartment_id = ? AND released_at IS NULL
                        """,
                Integer.class,
                roomId,
                compartmentId
        );
        if (existing != null && existing > 0) {
            return;
        }
        jdbcTemplate.update(
                """
                        INSERT INTO compartment_room_access (
                            id, fridge_compartment_id, room_id, assigned_at, released_at, created_at, updated_at
                        ) VALUES (?, ?, ?, NOW(), NULL, NOW(), NOW())
                        """,
                UUID.randomUUID(),
                compartmentId,
                roomId
        );
    }

    private void clearSlot(UUID slotId) {
        jdbcTemplate.update(
                """
                        DELETE FROM inspection_action_item
                        WHERE fridge_item_id IN (
                            SELECT id FROM fridge_item
                            WHERE fridge_bundle_id IN (
                                SELECT id FROM fridge_bundle WHERE fridge_compartment_id = ?
                            )
                        )
                        """,
                slotId
        );
        jdbcTemplate.update(
                """
                        DELETE FROM inspection_action_item
                        WHERE inspection_action_id IN (
                            SELECT id FROM inspection_action
                            WHERE fridge_bundle_id IN (
                                SELECT id FROM fridge_bundle WHERE fridge_compartment_id = ?
                            )
                        )
                        """,
                slotId
        );
        jdbcTemplate.update(
                "DELETE FROM inspection_action WHERE fridge_bundle_id IN (SELECT id FROM fridge_bundle WHERE fridge_compartment_id = ?)",
                slotId
        );
        jdbcTemplate.update(
                "DELETE FROM fridge_item WHERE fridge_bundle_id IN (SELECT id FROM fridge_bundle WHERE fridge_compartment_id = ?)",
                slotId
        );
        jdbcTemplate.update(
                "DELETE FROM fridge_bundle WHERE fridge_compartment_id = ?",
                slotId
        );
    }

    private UUID fetchSlotId(int floorNo, int slotIndex) {
        return jdbcTemplate.queryForObject(
                """
                        SELECT fc.id
                        FROM fridge_compartment fc
                        JOIN fridge_unit fu ON fu.id = fc.fridge_unit_id
                        WHERE fu.floor_no = ? AND fc.slot_index = ?
                        """,
                (rs, rowNum) -> UUID.fromString(rs.getString("id")),
                floorNo,
                slotIndex
        );
    }

    private UUID fetchRoomId(int floorNo, String roomNumber) {
        return jdbcTemplate.queryForObject(
                "SELECT id FROM room WHERE floor = ? AND room_number = ?",
                (rs, rowNum) -> UUID.fromString(rs.getString("id")),
                floorNo,
                roomNumber
        );
    }

    private UUID fetchUserId(String loginId) {
        return jdbcTemplate.queryForObject(
                "SELECT id FROM dorm_user WHERE login_id = ?",
                (rs, rowNum) -> UUID.fromString(rs.getString("id")),
                loginId
        );
    }

    private String login(String loginId, String password) throws Exception {
        String deviceId = loginId + "-device";
        MvcResult result = mockMvc.perform(post("/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "loginId": "%s",
                                  "password": "%s",
                                  "deviceId": "%s"
                                }
                                """.formatted(loginId, password, deviceId)))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode response = objectMapper.readTree(result.getResponse().getContentAsString());
        return response.path("tokens").path("accessToken").asText();
    }
}

package com.dormmate.backend.modules.inspection;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.dormmate.backend.modules.fridge.domain.FridgeItemStatus;
import com.dormmate.backend.modules.fridge.infrastructure.persistence.FridgeBundleRepository;
import com.dormmate.backend.modules.fridge.infrastructure.persistence.FridgeItemRepository;
import com.dormmate.backend.modules.inspection.domain.InspectionStatus;
import com.dormmate.backend.support.AbstractPostgresIntegrationTest;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.time.LocalDate;
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

    private String managerToken;
    private String residentToken;
    private List<UUID> bundlesToCleanup;
    private UUID slot2FAId;
    private UUID residentId;
    private UUID residentRoomId;

    @BeforeEach
    void setUp() throws Exception {
        bundlesToCleanup = new ArrayList<>();
        managerToken = login("bob", "bob123!");
        residentToken = login("alice", "alice123!");
        slot2FAId = fetchSlotId(FLOOR_2, SLOT_INDEX_A);
        residentId = fetchUserId("alice");
        residentRoomId = ensureResidentAssignment(residentId);
        ensureCompartmentAccess(residentRoomId, slot2FAId);

        jdbcTemplate.update("DELETE FROM inspection_action_item");
        jdbcTemplate.update("DELETE FROM inspection_action");
        jdbcTemplate.update("DELETE FROM inspection_participant");
        jdbcTemplate.update("DELETE FROM inspection_session");
        jdbcTemplate.update("UPDATE fridge_item SET status = 'ACTIVE', deleted_at = NULL");
        jdbcTemplate.update("UPDATE fridge_bundle SET status = 'ACTIVE', deleted_at = NULL");
        jdbcTemplate.update("UPDATE fridge_compartment SET is_locked = FALSE, locked_until = NULL");
    }

    @AfterEach
    void tearDown() {
        jdbcTemplate.update("DELETE FROM inspection_action_item");
        jdbcTemplate.update("DELETE FROM inspection_action");
        jdbcTemplate.update("DELETE FROM inspection_participant");
        jdbcTemplate.update("DELETE FROM inspection_session");
        bundlesToCleanup.forEach(id -> fridgeBundleRepository.findById(id)
                .ifPresent(fridgeBundleRepository::delete));
    }

    @Test
    void managerCanRunFullInspectionHappyPath() throws Exception {
        JsonNode bundle = ensureBundleForAlice(slot2FAId);
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
    void residentCanViewOwnInspectionSession() throws Exception {
        JsonNode bundle = ensureBundleForAlice(slot2FAId);
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
        JsonNode bundle = ensureBundleForAlice(slot2FAId);
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

    private JsonNode startInspection(String token, UUID slotId) throws Exception {
        MvcResult result = mockMvc.perform(post("/fridge/inspections")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "slotId": "%s"
                                }
                                """.formatted(slotId)))
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

    private JsonNode ensureBundleForAlice(UUID slotId) throws Exception {
        return createBundleForAlice(slotId);
    }

    private JsonNode createBundleForAlice(UUID slotId) throws Exception {
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
        MvcResult result = mockMvc.perform(post("/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "loginId": "%s",
                                  "password": "%s"
                                }
                                """.formatted(loginId, password)))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode response = objectMapper.readTree(result.getResponse().getContentAsString());
        return response.path("tokens").path("accessToken").asText();
    }
}

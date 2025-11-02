package com.dormmate.backend.modules.fridge;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.dormmate.backend.support.AbstractPostgresIntegrationTest;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;

import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

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
class FridgeReallocationIntegrationTest extends AbstractPostgresIntegrationTest {

    private static final short FLOOR_2 = 2;

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    private String adminToken;
    private String residentToken;

    @BeforeEach
    void setUp() throws Exception {
        adminToken = loginAndGetAccessToken("admin", "password");
        residentToken = loginAndGetAccessToken("alice", "alice123!");
    }

    @Test
    void adminCanPreviewAndApplyReallocation() throws Exception {
        JsonNode preview = requestPreview(FLOOR_2);
        assertThat(preview.path("floor").asInt()).isEqualTo(FLOOR_2);
        JsonNode rooms = preview.path("rooms");
        assertThat(rooms.isArray()).isTrue();
        assertThat(rooms.size()).isGreaterThanOrEqualTo(24);

        JsonNode allocations = preview.path("allocations");
        assertThat(allocations.isArray()).isTrue();
        assertThat(allocations.size()).isGreaterThan(0);

        ObjectNode applyPayload = buildApplyPayload(FLOOR_2, allocations);

        MvcResult applyResult = mockMvc.perform(
                        post("/admin/fridge/reallocations/apply")
                                .header("Authorization", "Bearer " + adminToken)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(applyPayload.toString())
                )
                .andExpect(status().isOk())
                .andReturn();

        JsonNode applyResponse = objectMapper.readTree(applyResult.getResponse().getContentAsString());
        assertThat(applyResponse.path("affectedCompartments").asInt()).isEqualTo(allocations.size());
        assertThat(applyResponse.path("createdAssignments").asInt()).isGreaterThan(0);

        verifyExclusiveAssignments(preview);
    }

    @Test
    void nonAdminCannotPreviewOrApplyReallocation() throws Exception {
        ObjectNode payload = objectMapper.createObjectNode();
        payload.put("floor", FLOOR_2);

        mockMvc.perform(
                        post("/admin/fridge/reallocations/preview")
                                .header("Authorization", "Bearer " + residentToken)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(payload.toString())
                )
                .andExpect(status().isForbidden());

        ObjectNode request = objectMapper.createObjectNode();
        request.put("floor", FLOOR_2);
        request.set("allocations", objectMapper.createArrayNode());

        mockMvc.perform(
                        post("/admin/fridge/reallocations/apply")
                                .header("Authorization", "Bearer " + residentToken)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(request.toString())
                )
                .andExpect(status().isForbidden());
    }

    @Test
    void applyFailsWhenCompartmentLocked() throws Exception {
        JsonNode preview = requestPreview(FLOOR_2);
        JsonNode allocations = preview.path("allocations");
        JsonNode chillAllocation = findFirstChillAllocation(allocations);
        UUID compartmentId = UUID.fromString(chillAllocation.path("compartmentId").asText());

        ObjectNode applyPayload = buildApplyPayload(FLOOR_2, allocations);

        try {
            jdbcTemplate.update(
                    "UPDATE fridge_compartment SET is_locked = TRUE WHERE id = ?",
                    ps -> ps.setObject(1, compartmentId)
            );

            mockMvc.perform(
                            post("/admin/fridge/reallocations/apply")
                                    .header("Authorization", "Bearer " + adminToken)
                                    .contentType(MediaType.APPLICATION_JSON)
                                    .content(applyPayload.toString())
                    )
                    .andExpect(status().isConflict())
                    .andExpect(jsonPath("$.code").value("COMPARTMENT_IN_USE"));
        } finally {
            jdbcTemplate.update(
                    "UPDATE fridge_compartment SET is_locked = FALSE, locked_until = NULL WHERE id = ?",
                    ps -> ps.setObject(1, compartmentId)
            );
        }
    }

    @Test
    void applyFailsWhenInspectionInProgress() throws Exception {
        JsonNode preview = requestPreview(FLOOR_2);
        JsonNode allocations = preview.path("allocations");
        JsonNode chillAllocation = findFirstChillAllocation(allocations);
        UUID compartmentId = UUID.fromString(chillAllocation.path("compartmentId").asText());
        UUID adminId = jdbcTemplate.queryForObject(
                "SELECT id FROM dorm_user WHERE login_id = 'admin'",
                (rs, rowNum) -> UUID.fromString(rs.getString("id"))
        );

        ObjectNode applyPayload = buildApplyPayload(FLOOR_2, allocations);

        UUID sessionId = UUID.randomUUID();
        try {
            jdbcTemplate.update(
                    "INSERT INTO inspection_session (id, fridge_compartment_id, started_by, status, started_at, created_at, updated_at) "
                            + "VALUES (?, ?, ?, 'IN_PROGRESS', now(), now(), now())",
                    ps -> {
                        ps.setObject(1, sessionId);
                        ps.setObject(2, compartmentId);
                        ps.setObject(3, adminId);
                    }
            );

            mockMvc.perform(
                            post("/admin/fridge/reallocations/apply")
                                    .header("Authorization", "Bearer " + adminToken)
                                    .contentType(MediaType.APPLICATION_JSON)
                                    .content(applyPayload.toString())
                    )
                    .andExpect(status().isConflict())
                    .andExpect(jsonPath("$.code").value("COMPARTMENT_IN_USE"));
        } finally {
            jdbcTemplate.update(
                    "DELETE FROM inspection_session WHERE id = ?",
                    ps -> ps.setObject(1, sessionId)
            );
        }
    }

    private JsonNode requestPreview(short floor) throws Exception {
        ObjectNode payload = objectMapper.createObjectNode();
        payload.put("floor", floor);

        MvcResult previewResult = mockMvc.perform(
                        post("/admin/fridge/reallocations/preview")
                                .header("Authorization", "Bearer " + adminToken)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(payload.toString())
                )
                .andExpect(status().isOk())
                .andReturn();

        return objectMapper.readTree(previewResult.getResponse().getContentAsString());
    }

    private ObjectNode buildApplyPayload(short floor, JsonNode allocations) {
        ObjectNode applyPayload = objectMapper.createObjectNode();
        applyPayload.put("floor", floor);
        ArrayNode applyAllocations = objectMapper.createArrayNode();
        allocations.forEach(node -> {
            ObjectNode allocation = objectMapper.createObjectNode();
            allocation.put("compartmentId", node.path("compartmentId").asText());
            allocation.set("roomIds", node.path("recommendedRoomIds"));
            applyAllocations.add(allocation);
        });
        applyPayload.set("allocations", applyAllocations);
        return applyPayload;
    }

    private JsonNode findFirstChillAllocation(JsonNode allocations) {
        for (JsonNode node : allocations) {
            if ("CHILL".equalsIgnoreCase(node.path("compartmentType").asText())) {
                return node;
            }
        }
        throw new AssertionError("No CHILL compartment allocation found");
    }

    private void verifyExclusiveAssignments(JsonNode preview) {
        JsonNode allocations = preview.path("allocations");
        Set<UUID> chillAssignments = new HashSet<>();
        Map<UUID, List<UUID>> compartmentToRooms = new HashMap<>();
        allocations.forEach(node -> {
            String type = node.path("compartmentType").asText();
            List<UUID> rooms = new java.util.ArrayList<>();
            node.path("recommendedRoomIds").forEach(r -> rooms.add(UUID.fromString(r.asText())));
            compartmentToRooms.put(UUID.fromString(node.path("compartmentId").asText()), rooms);
            if ("CHILL".equalsIgnoreCase(type)) {
                rooms.forEach(roomId -> {
                    boolean added = chillAssignments.add(roomId);
                    assertThat(added).as("room %s assigned multiple chill compartments", roomId).isTrue();
                });
            }
        });

        int floorRoomCount = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM room WHERE floor = ?",
                Integer.class,
                FLOOR_2
        );
        assertThat(chillAssignments).hasSize(floorRoomCount);

        // Ensure persisted assignments match expected counts
        compartmentToRooms.forEach((compartmentId, expectedRooms) -> {
            List<UUID> actualRooms = jdbcTemplate.query(
                    "SELECT room_id FROM compartment_room_access WHERE fridge_compartment_id = ? AND released_at IS NULL",
                    (rs, rowNum) -> UUID.fromString(rs.getString("room_id")),
                    compartmentId
            );
            if (expectedRooms.isEmpty()) {
                assertThat(actualRooms).isEmpty();
            } else {
                assertThat(actualRooms).containsExactlyInAnyOrderElementsOf(expectedRooms);
            }
        });
    }

    private String loginAndGetAccessToken(String loginId, String password) throws Exception {
        MvcResult result = mockMvc.perform(
                        post("/auth/login")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("""
                                        {
                                          \"loginId\": \"%s\",
                                          \"password\": \"%s\"
                                        }
                                        """.formatted(loginId, password))
                )
                .andExpect(status().isOk())
                .andReturn();

        JsonNode response = objectMapper.readTree(result.getResponse().getContentAsString());
        return response.path("tokens").path("accessToken").asText();
    }
}

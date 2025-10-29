package com.dormmate.backend.modules.inspection;

import static org.assertj.core.api.Assertions.assertThat;
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

    private static final String SLOT_2F_R1 = "2F-R1";

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

    @BeforeEach
    void setUp() throws Exception {
        bundlesToCleanup = new ArrayList<>();
        managerToken = login("bob", "bob123!");
        residentToken = login("alice", "alice123!");

        jdbcTemplate.update("DELETE FROM inspection_action_item");
        jdbcTemplate.update("DELETE FROM inspection_action");
        jdbcTemplate.update("DELETE FROM inspection_participant");
        jdbcTemplate.update("DELETE FROM inspection_session");
        jdbcTemplate.update("UPDATE fridge_item SET status = 'ACTIVE', deleted_at = NULL");
        jdbcTemplate.update("UPDATE fridge_bundle SET status = 'ACTIVE', deleted_at = NULL");
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
        JsonNode bundle = ensureBundleForAlice(SLOT_2F_R1);
        UUID bundleId = UUID.fromString(bundle.path("bundleId").asText());
        UUID itemId = UUID.fromString(bundle.path("items").get(0).path("itemId").asText());

        JsonNode session = startInspection(managerToken, SLOT_2F_R1);
        long sessionId = session.path("sessionId").asLong();

        recordDisposeAction(managerToken, sessionId, bundleId, itemId);

        JsonNode submitted = submitInspection(managerToken, sessionId);
        assertThat(submitted.path("status").asText()).isEqualTo(InspectionStatus.SUBMITTED.name());

        fridgeItemRepository.findById(itemId).ifPresent(item -> {
            assertThat(item.getStatus()).isEqualTo(FridgeItemStatus.REMOVED);
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
                                  "slotCode": "%s",
                                  "slotId": "%s"
                                }
                                """.formatted(SLOT_2F_R1, fetchSlotId(SLOT_2F_R1))))
                .andExpect(status().isForbidden());
    }

    @Test
    void managerCannotSubmitTwice() throws Exception {
        JsonNode session = startInspection(managerToken, SLOT_2F_R1);
        long sessionId = session.path("sessionId").asLong();

        submitInspection(managerToken, sessionId);

        mockMvc.perform(post("/fridge/inspections/%d/submit".formatted(sessionId))
                        .header("Authorization", "Bearer " + managerToken))
                .andExpect(status().isConflict());
    }

    @Test
    void managerCannotStartWhenSessionExists() throws Exception {
        startInspection(managerToken, SLOT_2F_R1);

        mockMvc.perform(post("/fridge/inspections")
                        .header("Authorization", "Bearer " + managerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "slotCode": "%s",
                                  "slotId": "%s"
                                }
                                """.formatted(SLOT_2F_R1, fetchSlotId(SLOT_2F_R1))))
                .andExpect(status().isConflict());
    }

    private JsonNode startInspection(String token, String slotCode) throws Exception {
        UUID slotId = fetchSlotId(slotCode);
        MvcResult result = mockMvc.perform(post("/fridge/inspections")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "slotCode": "%s",
                                  "slotId": "%s"
                                }
                                """.formatted(slotCode, slotId)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.sessionId").isNumber())
                .andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString());
    }

    private JsonNode submitInspection(String token, long sessionId) throws Exception {
        MvcResult result = mockMvc.perform(post("/fridge/inspections/%d/submit".formatted(sessionId))
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString());
    }

    private void recordDisposeAction(String token, long sessionId, UUID bundleId, UUID itemId) throws Exception {
        mockMvc.perform(post("/fridge/inspections/%d/actions".formatted(sessionId))
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
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.summary[0].count").value(1));
    }

    private JsonNode ensureBundleForAlice(String slotCode) throws Exception {
        return createBundleForAlice(slotCode);
    }

    private JsonNode createBundleForAlice(String slotCode) throws Exception {
        String expiresOn = LocalDate.now(ZoneOffset.UTC).plusDays(2).toString();
        MvcResult result = mockMvc.perform(post("/fridge/bundles")
                        .header("Authorization", "Bearer " + residentToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "slotCode": "%s",
                                  "bundleName": "Inspection 테스트 포장",
                                  "items": [
                                    {
                                      "name": "테스트 식품",
                                      "expiryDate": "%s",
                                      "quantity": 1
                                    }
                                  ]
                                }
                                """.formatted(slotCode, expiresOn)))
                .andExpect(status().isCreated())
                .andReturn();

        JsonNode bundle = objectMapper.readTree(result.getResponse().getContentAsString()).path("bundle");
        bundlesToCleanup.add(UUID.fromString(bundle.path("bundleId").asText()));
        return bundle;
    }

    private UUID fetchSlotId(String slotCode) {
        return jdbcTemplate.queryForObject(
                "SELECT id FROM fridge_compartment WHERE slot_code = ?",
                (rs, rowNum) -> UUID.fromString(rs.getString(1)),
                slotCode
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

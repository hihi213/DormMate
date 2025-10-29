package com.dormmate.backend.modules.fridge;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.dormmate.backend.modules.fridge.domain.FridgeItemStatus;
import com.dormmate.backend.modules.fridge.infrastructure.persistence.FridgeBundleRepository;
import com.dormmate.backend.modules.fridge.infrastructure.persistence.FridgeItemRepository;
import com.dormmate.backend.support.AbstractPostgresIntegrationTest;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.AfterEach;
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
class FridgeIntegrationTest extends AbstractPostgresIntegrationTest {

    private static final String SLOT_FLOOR2_R2 = "2F-R2";
    private static final String SLOT_FLOOR3_R1 = "3F-R1";
    private static final String SLOT_FLOOR2_R1 = "2F-R1";

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

    private final List<UUID> bundlesToCleanup = new ArrayList<>();

    @AfterEach
    void tearDown() {
        bundlesToCleanup.forEach(id -> fridgeBundleRepository.findById(id)
                .ifPresent(fridgeBundleRepository::delete));
        bundlesToCleanup.clear();
    }

    @Test
    void residentCannotCreateBundleOutsideAssignedSlot() throws Exception {
        String accessToken = loginAndGetAccessToken("alice", "alice123!");

        String expiresOn = LocalDate.now(ZoneOffset.UTC).plusDays(3).toString();
        mockMvc.perform(
                        post("/fridge/bundles")
                                .header("Authorization", "Bearer " + accessToken)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("""
                                        {
                                          "slotCode": "%s",
                                          "bundleName": "다른 층 침범",
                                          "items": [
                                            {
                                              "name": "테스트 우유",
                                              "expiryDate": "%s",
                                              "quantity": 1
                                            }
                                          ]
                                        }
                                        """.formatted(SLOT_FLOOR3_R1, expiresOn))
                )
                .andExpect(status().isForbidden());
    }

    @Test
    void capacityExceededReturnsUnprocessableEntity() throws Exception {
        String accessToken = loginAndGetAccessToken("bob", "bob123!");

        Integer originalCapacity = jdbcTemplate.queryForObject(
                "SELECT max_bundle_count FROM fridge_compartment WHERE slot_code = ?",
                Integer.class,
                SLOT_FLOOR2_R2
        );
        Integer originalNextLabel = jdbcTemplate.queryForObject(
                "SELECT next_label FROM bundle_label_sequence WHERE fridge_compartment_id = (SELECT id FROM fridge_compartment WHERE slot_code = ?)",
                Integer.class,
                SLOT_FLOOR2_R2
        );

        jdbcTemplate.update(
                "DELETE FROM fridge_item WHERE fridge_bundle_id IN (SELECT id FROM fridge_bundle WHERE fridge_compartment_id = (SELECT id FROM fridge_compartment WHERE slot_code = ?))",
                SLOT_FLOOR2_R2
        );
        jdbcTemplate.update(
                "DELETE FROM fridge_bundle WHERE fridge_compartment_id = (SELECT id FROM fridge_compartment WHERE slot_code = ?)",
                SLOT_FLOOR2_R2
        );
        jdbcTemplate.update(
                "UPDATE fridge_compartment SET max_bundle_count = ? WHERE slot_code = ?",
                1,
                SLOT_FLOOR2_R2
        );
        jdbcTemplate.update(
                """
                        INSERT INTO bundle_label_sequence (fridge_compartment_id, next_label)
                        VALUES ((SELECT id FROM fridge_compartment WHERE slot_code = ?), ?)
                        ON CONFLICT (fridge_compartment_id) DO UPDATE
                        SET next_label = EXCLUDED.next_label
                        """,
                SLOT_FLOOR2_R2,
                1
        );

        UUID firstBundleId = null;
        try {
            JsonNode firstBundle = createBundle(accessToken, SLOT_FLOOR2_R2, "용량 테스트 1");
            firstBundleId = UUID.fromString(firstBundle.path("bundle").path("bundleId").asText());

            String expiresOn = LocalDate.now(ZoneOffset.UTC).plusDays(5).toString();
            mockMvc.perform(
                            post("/fridge/bundles")
                                    .header("Authorization", "Bearer " + accessToken)
                                    .contentType(MediaType.APPLICATION_JSON)
                                    .content("""
                                            {
                                              "slotCode": "%s",
                                              "bundleName": "용량 테스트 2",
                                              "items": [
                                                {
                                                  "name": "버터",
                                                  "expiryDate": "%s",
                                                  "quantity": 1
                                                }
                                              ]
                                            }
                                            """.formatted(SLOT_FLOOR2_R2, expiresOn))
                    )
                    .andExpect(status().isUnprocessableEntity());
        } finally {
            if (firstBundleId != null) {
                fridgeBundleRepository.findById(firstBundleId)
                        .ifPresent(fridgeBundleRepository::delete);
            }
            if (originalCapacity != null) {
                jdbcTemplate.update(
                        "UPDATE fridge_compartment SET max_bundle_count = ? WHERE slot_code = ?",
                        originalCapacity,
                        SLOT_FLOOR2_R2
                );
            }
            if (originalNextLabel != null) {
                jdbcTemplate.update(
                        "UPDATE bundle_label_sequence SET next_label = ? WHERE fridge_compartment_id = (SELECT id FROM fridge_compartment WHERE slot_code = ?)",
                        originalNextLabel,
                        SLOT_FLOOR2_R2
                );
            }
        }
    }

    @Test
    void slotViewReflectsCapacityAndActiveChanges() throws Exception {
        String managerToken = loginAndGetAccessToken("bob", "bob123!");

        Integer originalCapacity = jdbcTemplate.queryForObject(
                "SELECT max_bundle_count FROM fridge_compartment WHERE slot_code = ?",
                Integer.class,
                SLOT_FLOOR2_R1
        );
        Boolean originalActive = jdbcTemplate.queryForObject(
                "SELECT is_active FROM fridge_compartment WHERE slot_code = ?",
                Boolean.class,
                SLOT_FLOOR2_R1
        );

        int updatedCapacity = (originalCapacity != null ? originalCapacity : 0) + 3;
        boolean updatedActive = originalActive != null && !originalActive;

        try {
            jdbcTemplate.update(
                    "UPDATE fridge_compartment SET max_bundle_count = ?, is_active = ? WHERE slot_code = ?",
                    updatedCapacity,
                    updatedActive,
                    SLOT_FLOOR2_R1
            );

            MvcResult result = mockMvc.perform(
                            get("/fridge/slots")
                                    .param("view", "full")
                                    .param("size", "200")
                                    .header("Authorization", "Bearer " + managerToken)
                    )
                    .andExpect(status().isOk())
                    .andReturn();

            JsonNode slots = objectMapper.readTree(result.getResponse().getContentAsString());
            JsonNode slot = findSlotByCode(slots, SLOT_FLOOR2_R1);

            assertThat(slot.path("capacity").asInt()).isEqualTo(updatedCapacity);
            assertThat(slot.path("isActive").asBoolean()).isEqualTo(updatedActive);
            assertThat(slot.path("labelRangeStart").isMissingNode()).isFalse();
            assertThat(slot.path("labelRangeEnd").isMissingNode()).isFalse();
        } finally {
            jdbcTemplate.update(
                    "UPDATE fridge_compartment SET max_bundle_count = ?, is_active = ? WHERE slot_code = ?",
                    originalCapacity,
                    originalActive,
                    SLOT_FLOOR2_R1
            );
        }
    }

    @Test
    void bundleListAndDetailIncludeOwnerAndCounts() throws Exception {
        String aliceToken = loginAndGetAccessToken("alice", "alice123!");
        String managerToken = loginAndGetAccessToken("bob", "bob123!");

        clearSlotBundles(SLOT_FLOOR2_R1);

        String aliceBundleName = "alice-verification-bundle";
        String managerBundleName = "bob-verification-bundle";

        JsonNode aliceBundle = createBundle(aliceToken, SLOT_FLOOR2_R1, aliceBundleName);
        JsonNode bobBundle = createBundle(managerToken, SLOT_FLOOR2_R1, managerBundleName);

        UUID aliceBundleId = UUID.fromString(aliceBundle.path("bundle").path("bundleId").asText());
        UUID bobBundleId = UUID.fromString(bobBundle.path("bundle").path("bundleId").asText());

        MvcResult listResult = mockMvc.perform(
                        get("/fridge/bundles")
                                .param("slotCode", SLOT_FLOOR2_R1)
                                .param("owner", "all")
                                .header("Authorization", "Bearer " + managerToken)
                )
                .andExpect(status().isOk())
                .andReturn();

        JsonNode bundleList = objectMapper.readTree(listResult.getResponse().getContentAsString());
        JsonNode summaries = bundleList.path("items");

        JsonNode aliceSummary = findBundleSummaryById(summaries, aliceBundleId);
        JsonNode bobSummary = findBundleSummaryById(summaries, bobBundleId);

        assertThat(aliceSummary.path("ownerDisplayName").asText()).isEqualTo("Alice Kim");
        assertThat(aliceSummary.path("itemCount").asInt()).isEqualTo(1);
        assertThat(bobSummary.path("ownerDisplayName").asText()).isEqualTo("Bob Lee");
        assertThat(bobSummary.path("itemCount").asInt()).isEqualTo(1);

        MvcResult detailResult = mockMvc.perform(
                        get("/fridge/bundles/" + aliceBundleId)
                                .header("Authorization", "Bearer " + managerToken)
                )
                .andExpect(status().isOk())
                .andReturn();

        JsonNode detail = objectMapper.readTree(detailResult.getResponse().getContentAsString());
        assertThat(detail.path("bundleName").asText()).isEqualTo(aliceBundleName);
        assertThat(detail.path("ownerDisplayName").asText()).isEqualTo("Alice Kim");
        assertThat(detail.path("items").isArray()).isTrue();
        assertThat(detail.path("items").size()).isEqualTo(1);
        assertThat(detail.path("items").get(0).path("name").asText()).isNotBlank();
    }

    @Test
    void residentCanMarkItemAsRemoved() throws Exception {
        String accessToken = loginAndGetAccessToken("alice", "alice123!");

        JsonNode bundleResponse = createBundle(accessToken, SLOT_FLOOR2_R1, "미등록 처리 테스트");
        UUID itemId = UUID.fromString(bundleResponse.path("bundle").path("items").get(0).path("itemId").asText());

        String removalTimestamp = OffsetDateTime.now(ZoneOffset.UTC).toString();
        mockMvc.perform(
                        patch("/fridge/items/" + itemId)
                                .header("Authorization", "Bearer " + accessToken)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("""
                                        {
                                          "removedAt": "%s"
                                        }
                                        """.formatted(removalTimestamp))
                )
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.removedAt").isNotEmpty());

        fridgeItemRepository.findById(itemId).ifPresent(item -> {
            assertThat(item.getStatus()).isEqualTo(FridgeItemStatus.REMOVED);
            assertThat(item.getDeletedAt()).isNotNull();
        });
    }

    private JsonNode createBundle(String accessToken, String slotCode, String bundleName) throws Exception {
        String expiresOn = LocalDate.now(ZoneOffset.UTC).plusDays(4).toString();
        MvcResult result = mockMvc.perform(
                        post("/fridge/bundles")
                                .header("Authorization", "Bearer " + accessToken)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("""
                                        {
                                          "slotCode": "%s",
                                          "bundleName": "%s",
                                          "items": [
                                            {
                                              "name": "테스트 식품",
                                              "expiryDate": "%s",
                                              "quantity": 1
                                            }
                                          ]
                                        }
                                        """.formatted(slotCode, bundleName, expiresOn))
                )
                .andExpect(status().isCreated())
                .andReturn();
        JsonNode bundle = objectMapper.readTree(result.getResponse().getContentAsString());
        bundlesToCleanup.add(UUID.fromString(bundle.path("bundle").path("bundleId").asText()));
        return bundle;
    }

    private String loginAndGetAccessToken(String loginId, String password) throws Exception {
        MvcResult result = mockMvc.perform(
                        post("/auth/login")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("""
                                        {
                                          "loginId": "%s",
                                          "password": "%s"
                                        }
                                        """.formatted(loginId, password))
                )
                .andExpect(status().isOk())
                .andReturn();
        JsonNode response = objectMapper.readTree(result.getResponse().getContentAsString());
        return response.path("tokens").path("accessToken").asText();
    }

    private JsonNode findSlotByCode(JsonNode slots, String slotCode) {
        for (JsonNode slot : slots) {
            if (slot.path("slotCode").asText().equals(slotCode)) {
                return slot;
            }
        }
        throw new AssertionError("slot not found: " + slotCode);
    }

    private JsonNode findBundleSummaryById(JsonNode summaries, UUID bundleId) {
        for (JsonNode summary : summaries) {
            if (summary.path("bundleId").asText().equals(bundleId.toString())) {
                return summary;
            }
        }
        throw new AssertionError("bundle summary not found: " + bundleId);
    }

    private void clearSlotBundles(String slotCode) {
        jdbcTemplate.update(
                "DELETE FROM fridge_item WHERE fridge_bundle_id IN (SELECT id FROM fridge_bundle WHERE fridge_compartment_id = (SELECT id FROM fridge_compartment WHERE slot_code = ?))",
                slotCode
        );
        jdbcTemplate.update(
                "DELETE FROM fridge_bundle WHERE fridge_compartment_id = (SELECT id FROM fridge_compartment WHERE slot_code = ?)",
                slotCode
        );
    }
}

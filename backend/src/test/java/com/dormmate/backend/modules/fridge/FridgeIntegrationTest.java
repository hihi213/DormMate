package com.dormmate.backend.modules.fridge;

import static com.dormmate.backend.support.TestResidentAccounts.DEFAULT_PASSWORD;
import static com.dormmate.backend.support.TestResidentAccounts.FLOOR2_ROOM05_SLOT1;
import static com.dormmate.backend.support.TestResidentAccounts.FLOOR2_ROOM05_SLOT3;
import static com.dormmate.backend.support.TestResidentAccounts.FLOOR2_ROOM17_SLOT2;
import static com.dormmate.backend.support.TestResidentAccounts.FLOOR3_ROOM05_SLOT1;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
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

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Types;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.ResultSetExtractor;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

@SpringBootTest
@AutoConfigureMockMvc
class FridgeIntegrationTest extends AbstractPostgresIntegrationTest {

    private static final int FLOOR_2 = 2;
    private static final int FLOOR_3 = 3;
    private static final int SLOT_INDEX_A = 0;
    private static final int SLOT_INDEX_B = 1;

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
    private final Map<String, String> tokenOwners = new HashMap<>();

    @BeforeEach
    void ensureDefaultAccess() {
        UUID slot2A = fetchSlotId(FLOOR_2, SLOT_INDEX_A);
        ensureResidentHasAccess(FLOOR2_ROOM05_SLOT1, slot2A);
        ensureResidentHasAccess(FLOOR2_ROOM05_SLOT3, slot2A);
        UUID slot3A = fetchSlotId(FLOOR_3, SLOT_INDEX_A);
        ensureResidentHasAccess(FLOOR3_ROOM05_SLOT1, slot3A);
    }

    @AfterEach
    void tearDown() {
        bundlesToCleanup.forEach(id -> fridgeBundleRepository.findById(id)
                .ifPresent(fridgeBundleRepository::delete));
        bundlesToCleanup.clear();
        tokenOwners.clear();
    }

    @Test
    void residentCannotCreateBundleOutsideAssignedSlot() throws Exception {
        String accessToken = loginAndGetAccessToken(FLOOR2_ROOM05_SLOT1, DEFAULT_PASSWORD);
        UUID otherFloorSlotId = fetchSlotId(FLOOR_3, SLOT_INDEX_A);

        String expiresOn = LocalDate.now(ZoneOffset.UTC).plusDays(3).toString();
        mockMvc.perform(
                        post("/fridge/bundles")
                                .header("Authorization", "Bearer " + accessToken)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("""
                                        {
                                          "slotId": "%s",
                                          "bundleName": "다른 층 침범",
                                          "items": [
                                            {
                                              "name": "테스트 우유",
                                              "expiryDate": "%s",
                                              "quantity": 1
                                            }
                                          ]
                                        }
                                        """.formatted(otherFloorSlotId, expiresOn))
                )
                .andExpect(status().isForbidden());
    }

    @Test
    void capacityExceededReturnsUnprocessableEntity() throws Exception {
        String accessToken = loginAndGetAccessToken(FLOOR2_ROOM05_SLOT1, DEFAULT_PASSWORD);
        UUID slotId = fetchSlotId(FLOOR_2, SLOT_INDEX_A);

        Integer originalCapacity = jdbcTemplate.queryForObject(
                "SELECT max_bundle_count FROM fridge_compartment WHERE id = ?",
                Integer.class,
                slotId
        );

        LabelSequenceState originalLabelState = jdbcTemplate.query(
                """
                        SELECT next_number, recycled_numbers::text AS recycled_numbers
                        FROM bundle_label_sequence
                        WHERE fridge_compartment_id = ?
                        """,
                singleLabelState(),
                slotId
        );

        clearSlotBundles(slotId);
        jdbcTemplate.update(
                "UPDATE fridge_compartment SET max_bundle_count = ? WHERE id = ?",
                1,
                slotId
        );
        jdbcTemplate.update(
                """
                        INSERT INTO bundle_label_sequence (fridge_compartment_id, next_number, recycled_numbers)
                        VALUES (?, ?, '[]'::jsonb)
                        ON CONFLICT (fridge_compartment_id) DO UPDATE
                        SET next_number = EXCLUDED.next_number,
                            recycled_numbers = '[]'::jsonb
                        """,
                slotId,
                1
        );

        UUID firstBundleId = null;
        try {
            JsonNode firstBundle = createBundle(accessToken, slotId, "용량 테스트 1");
            firstBundleId = UUID.fromString(firstBundle.path("bundle").path("bundleId").asText());

            String expiresOn = LocalDate.now(ZoneOffset.UTC).plusDays(5).toString();
            mockMvc.perform(
                            post("/fridge/bundles")
                                    .header("Authorization", "Bearer " + accessToken)
                                    .contentType(MediaType.APPLICATION_JSON)
                                    .content("""
                                            {
                                              "slotId": "%s",
                                              "bundleName": "용량 테스트 2",
                                              "items": [
                                                {
                                                  "name": "버터",
                                                  "expiryDate": "%s",
                                                  "quantity": 1
                                                }
                                              ]
                                            }
                                            """.formatted(slotId, expiresOn))
                    )
                    .andExpect(status().isUnprocessableEntity())
                    .andExpect(jsonPath("$.code").value("CAPACITY_EXCEEDED"))
                    .andExpect(jsonPath("$.detail").value("CAPACITY_EXCEEDED"));
        } finally {
            if (firstBundleId != null) {
                fridgeBundleRepository.findById(firstBundleId)
                        .ifPresent(fridgeBundleRepository::delete);
            }
            if (originalCapacity != null) {
                jdbcTemplate.update(
                        "UPDATE fridge_compartment SET max_bundle_count = ? WHERE id = ?",
                        originalCapacity,
                        slotId
                );
            }
            restoreLabelSequence(slotId, originalLabelState);
        }
    }

    @Test
    void concurrentBundleCreationReturnsCapacityExceededForSecondRequest() throws Exception {
        String accessToken = loginAndGetAccessToken(FLOOR2_ROOM05_SLOT1, DEFAULT_PASSWORD);
        UUID slotId = fetchSlotId(FLOOR_2, SLOT_INDEX_A);

        Integer originalCapacity = jdbcTemplate.queryForObject(
                "SELECT max_bundle_count FROM fridge_compartment WHERE id = ?",
                Integer.class,
                slotId
        );

        LabelSequenceState originalLabelState = jdbcTemplate.query(
                """
                        SELECT next_number, recycled_numbers::text AS recycled_numbers
                        FROM bundle_label_sequence
                        WHERE fridge_compartment_id = ?
                        """,
                singleLabelState(),
                slotId
        );

        clearSlotBundles(slotId);
        jdbcTemplate.update(
                "UPDATE fridge_compartment SET max_bundle_count = ? WHERE id = ?",
                1,
                slotId
        );
        jdbcTemplate.update(
                """
                        INSERT INTO bundle_label_sequence (fridge_compartment_id, next_number, recycled_numbers)
                        VALUES (?, ?, '[]'::jsonb)
                        ON CONFLICT (fridge_compartment_id) DO UPDATE
                        SET next_number = EXCLUDED.next_number,
                            recycled_numbers = '[]'::jsonb
                        """,
                slotId,
                1
        );

        ExecutorService executor = Executors.newFixedThreadPool(2);
        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch start = new CountDownLatch(1);

        Callable<MockHttpServletResponse> task = () -> {
            ready.countDown();
            boolean started = start.await(5, TimeUnit.SECONDS);
            assertThat(started).isTrue();
            String expiresOn = LocalDate.now(ZoneOffset.UTC).plusDays(7).toString();
            return mockMvc.perform(
                            post("/fridge/bundles")
                                    .header("Authorization", "Bearer " + accessToken)
                                    .contentType(MediaType.APPLICATION_JSON)
                                    .content("""
                                            {
                                              "slotId": "%s",
                                              "bundleName": "동시 등록 테스트",
                                              "items": [
                                                {
                                                  "name": "테스트 음료",
                                                  "expiryDate": "%s",
                                                  "quantity": 1
                                                }
                                              ]
                                            }
                                            """.formatted(slotId, expiresOn))
                    )
                    .andReturn()
                    .getResponse();
        };

        Future<MockHttpServletResponse> first = executor.submit(task);
        Future<MockHttpServletResponse> second = executor.submit(task);

        try {
            ready.await(5, TimeUnit.SECONDS);
            start.countDown();

            MockHttpServletResponse response1 = first.get(10, TimeUnit.SECONDS);
            MockHttpServletResponse response2 = second.get(10, TimeUnit.SECONDS);

            List<MockHttpServletResponse> responses = List.of(response1, response2);
            assertThat(responses.stream().map(MockHttpServletResponse::getStatus))
                    .containsExactlyInAnyOrder(
                            HttpStatus.CREATED.value(),
                            HttpStatus.UNPROCESSABLE_ENTITY.value()
                    );

            MockHttpServletResponse successResponse = responses.stream()
                    .filter(res -> res.getStatus() == HttpStatus.CREATED.value())
                    .findFirst()
                    .orElseThrow();
            JsonNode successJson = readJson(successResponse);
            bundlesToCleanup.add(UUID.fromString(successJson.path("bundle").path("bundleId").asText()));

            MockHttpServletResponse failureResponse = responses.stream()
                    .filter(res -> res.getStatus() == HttpStatus.UNPROCESSABLE_ENTITY.value())
                    .findFirst()
                    .orElseThrow();
            JsonNode failureJson = readJson(failureResponse);
            assertThat(failureJson.path("code").asText()).isEqualTo("CAPACITY_EXCEEDED");
            assertThat(failureJson.path("detail").asText()).isEqualTo("CAPACITY_EXCEEDED");
        } finally {
            executor.shutdownNow();
            if (originalCapacity != null) {
                jdbcTemplate.update(
                        "UPDATE fridge_compartment SET max_bundle_count = ? WHERE id = ?",
                        originalCapacity,
                        slotId
                );
            }
            restoreLabelSequence(slotId, originalLabelState);
        }
    }

    @Test
    void ownerCanUpdateBundleNameAndMemo() throws Exception {
        String residentToken = loginAndGetAccessToken(FLOOR2_ROOM05_SLOT1, DEFAULT_PASSWORD);
        UUID slotId = fetchSlotId(FLOOR_2, SLOT_INDEX_A);

        clearSlotBundles(slotId);

        JsonNode bundleResponse = createBundle(residentToken, slotId, "initial bundle");
        UUID bundleId = UUID.fromString(bundleResponse.path("bundle").path("bundleId").asText());

        MvcResult updateResult = mockMvc.perform(
                        patch("/fridge/bundles/" + bundleId)
                                .header("Authorization", "Bearer " + residentToken)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("""
                                        {
                                          "bundleName": "updated bundle",
                                          "memo": "updated memo"
                                        }
                                        """))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode updatedBundle = readJson(updateResult);
        assertThat(updatedBundle.path("bundleName").asText()).isEqualTo("updated bundle");
        assertThat(updatedBundle.path("memo").asText()).isEqualTo("updated memo");

        MvcResult listResult = mockMvc.perform(
                        get("/fridge/bundles")
                                .param("slotId", slotId.toString())
                                .header("Authorization", "Bearer " + residentToken)
                )
                .andExpect(status().isOk())
                .andReturn();

        JsonNode summaries = readJson(listResult).path("items");
        JsonNode summary = findBundleSummaryById(summaries, bundleId);
        assertThat(summary.path("bundleName").asText()).isEqualTo("updated bundle");
    }

    @Test
    void bundleUpdateFailsWhenLocked() throws Exception {
        String residentToken = loginAndGetAccessToken(FLOOR2_ROOM05_SLOT1, DEFAULT_PASSWORD);
        UUID slotId = fetchSlotId(FLOOR_2, SLOT_INDEX_A);

        clearSlotBundles(slotId);

        JsonNode bundleResponse = createBundle(residentToken, slotId, "lock test");
        UUID bundleId = UUID.fromString(bundleResponse.path("bundle").path("bundleId").asText());

        LockState original = fetchLockState(slotId);
        applyLockState(slotId, true, OffsetDateTime.now(ZoneOffset.UTC).plusHours(1));
        try {
            mockMvc.perform(
                            patch("/fridge/bundles/" + bundleId)
                                    .header("Authorization", "Bearer " + residentToken)
                                    .contentType(MediaType.APPLICATION_JSON)
                                    .content("""
                                            { "bundleName": "should fail" }
                                            """))
                    .andExpect(status().isLocked())
                    .andExpect(jsonPath("$.code").value("COMPARTMENT_LOCKED"));
        } finally {
            applyLockState(slotId, original.locked(), original.lockedUntil());
        }
    }

    @Test
    void ownerCanUpdateItem() throws Exception {
        String residentToken = loginAndGetAccessToken(FLOOR2_ROOM05_SLOT1, DEFAULT_PASSWORD);
        UUID slotId = fetchSlotId(FLOOR_2, SLOT_INDEX_A);

        clearSlotBundles(slotId);

        JsonNode bundleResponse = createBundle(residentToken, slotId, "item update");
        JsonNode itemNode = bundleResponse.path("bundle").path("items").get(0);
        UUID itemId = UUID.fromString(itemNode.path("itemId").asText());

        String newExpiry = LocalDate.now(ZoneOffset.UTC).plusDays(10).toString();

        MvcResult updateItemResult = mockMvc.perform(
                        patch("/fridge/items/" + itemId)
                                .header("Authorization", "Bearer " + residentToken)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("""
                                        {
                                          "name": "updated item",
                                          "expiryDate": "%s",
                                          "quantity": 3
                                        }
                                        """.formatted(newExpiry)))
                .andReturn();

        assertThat(updateItemResult.getResponse().getStatus()).isEqualTo(HttpStatus.OK.value());
        JsonNode updatedItem = readJson(updateItemResult);
        assertThat(updatedItem.path("name").asText()).isEqualTo("updated item");
        assertThat(updatedItem.path("quantity").asInt()).isEqualTo(3);
        assertThat(updatedItem.path("expiryDate").asText()).isEqualTo(newExpiry);
    }

    @Test
    void itemUpdateFailsForUnauthorizedUser() throws Exception {
        String residentToken = loginAndGetAccessToken(FLOOR2_ROOM05_SLOT1, DEFAULT_PASSWORD);
        String otherResidentToken = loginAndGetAccessToken(FLOOR2_ROOM17_SLOT2, DEFAULT_PASSWORD);
        UUID slotId = fetchSlotId(FLOOR_2, SLOT_INDEX_A);

        clearSlotBundles(slotId);

        JsonNode bundleResponse = createBundle(residentToken, slotId, "permission test");
        JsonNode itemNode = bundleResponse.path("bundle").path("items").get(0);
        UUID itemId = UUID.fromString(itemNode.path("itemId").asText());

        MvcResult unauthorizedResult = mockMvc.perform(
                        patch("/fridge/items/" + itemId)
                                .header("Authorization", "Bearer " + otherResidentToken)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("""
                                        {
                                          "quantity": 5
                                        }
                                        """))
                .andReturn();

        assertThat(unauthorizedResult.getResponse().getStatus()).isEqualTo(HttpStatus.FORBIDDEN.value());
        JsonNode unauthorizedBody = readJson(unauthorizedResult);
        assertThat(unauthorizedBody.path("code").asText()).isEqualTo("FORBIDDEN_SLOT");
    }

    @Test
    void itemUpdateFailsWhenLocked() throws Exception {
        String residentToken = loginAndGetAccessToken(FLOOR2_ROOM05_SLOT1, DEFAULT_PASSWORD);
        UUID slotId = fetchSlotId(FLOOR_2, SLOT_INDEX_A);

        clearSlotBundles(slotId);

        JsonNode bundleResponse = createBundle(residentToken, slotId, "locked item test");
        JsonNode itemNode = bundleResponse.path("bundle").path("items").get(0);
        UUID itemId = UUID.fromString(itemNode.path("itemId").asText());

        LockState original = fetchLockState(slotId);
        applyLockState(slotId, true, OffsetDateTime.now(ZoneOffset.UTC).plusHours(1));
        try {
            mockMvc.perform(
                            patch("/fridge/items/" + itemId)
                                    .header("Authorization", "Bearer " + residentToken)
                                    .contentType(MediaType.APPLICATION_JSON)
                                    .content("""
                                            {
                                              "quantity": 2
                                            }
                                            """))
                    .andExpect(status().isLocked())
                    .andExpect(jsonPath("$.code").value("COMPARTMENT_LOCKED"));
        } finally {
            applyLockState(slotId, original.locked(), original.lockedUntil());
        }
    }
    @Test
    void adminCanUpdateCompartmentConfigViaApi() throws Exception {
        String adminToken = loginAndGetAccessToken("dormmate", "admin1!");
        String residentToken = loginAndGetAccessToken(FLOOR2_ROOM05_SLOT1, DEFAULT_PASSWORD);
        UUID slotId = fetchSlotId(FLOOR_2, SLOT_INDEX_A);

        int originalCapacity = jdbcTemplate.queryForObject(
                "SELECT max_bundle_count FROM fridge_compartment WHERE id = ?",
                Integer.class,
                slotId
        );
        String originalStatus = jdbcTemplate.queryForObject(
                "SELECT status FROM fridge_compartment WHERE id = ?",
                String.class,
                slotId
        );

        int updatedCapacity = originalCapacity + 2;
        try {
            mockMvc.perform(patch("/admin/fridge/compartments/" + slotId)
                            .header("Authorization", "Bearer " + adminToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                    {
                                      "maxBundleCount": %d,
                                      "status": "SUSPENDED"
                                    }
                                    """.formatted(updatedCapacity)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.capacity").value(updatedCapacity))
                    .andExpect(jsonPath("$.resourceStatus").value("SUSPENDED"));

            mockMvc.perform(get("/fridge/bundles")
                            .param("slotId", slotId.toString())
                            .header("Authorization", "Bearer " + residentToken))
                    .andExpect(status().isLocked());
        } finally {
            mockMvc.perform(patch("/admin/fridge/compartments/" + slotId)
                            .header("Authorization", "Bearer " + adminToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                    {
                                      "maxBundleCount": %d,
                                      "status": "%s"
                                    }
                                    """.formatted(originalCapacity, originalStatus)))
                    .andExpect(status().isOk());
        }
    }

    @Test
    void cannotCreateBundleWhenCompartmentLocked() throws Exception {
        String accessToken = loginAndGetAccessToken(FLOOR2_ROOM05_SLOT1, DEFAULT_PASSWORD);
        UUID slotId = fetchSlotId(FLOOR_2, SLOT_INDEX_A);

        LockState originalLockState = fetchLockState(slotId);
        OffsetDateTime lockedUntil = OffsetDateTime.now(ZoneOffset.UTC).plusHours(1);

        applyLockState(slotId, true, lockedUntil);
        try {
            String expiresOn = LocalDate.now(ZoneOffset.UTC).plusDays(2).toString();
            mockMvc.perform(
                            post("/fridge/bundles")
                                    .header("Authorization", "Bearer " + accessToken)
                                    .contentType(MediaType.APPLICATION_JSON)
                                    .content("""
                                            {
                                              "slotId": "%s",
                                              "bundleName": "잠금 테스트",
                                              "items": [
                                                {
                                                  "name": "테스트 요구르트",
                                                  "expiryDate": "%s",
                                                  "quantity": 1
                                                }
                                              ]
                                            }
                                            """.formatted(slotId, expiresOn))
                    )
                    .andExpect(status().isLocked())
                    .andExpect(jsonPath("$.code").value("COMPARTMENT_LOCKED"));
        } finally {
            applyLockState(slotId, originalLockState.locked(), originalLockState.lockedUntil());
        }
    }

    @Test
    void cannotCreateBundleDuringActiveInspection() throws Exception {
        String managerToken = loginAndGetAccessToken(FLOOR2_ROOM05_SLOT3, DEFAULT_PASSWORD);
        String residentToken = loginAndGetAccessToken(FLOOR2_ROOM05_SLOT1, DEFAULT_PASSWORD);
        UUID slotId = fetchSlotId(FLOOR_2, SLOT_INDEX_A);

        LockState originalLockState = fetchLockState(slotId);
        applyLockState(slotId, false, null);

        UUID sessionId = null;
        try {
            MvcResult startResult = mockMvc.perform(
                            post("/fridge/inspections")
                                    .header("Authorization", "Bearer " + managerToken)
                                    .contentType(MediaType.APPLICATION_JSON)
                                    .content("""
                                            {
                                              "slotId": "%s"
                                            }
                                            """.formatted(slotId))
                    )
                    .andExpect(status().isCreated())
                    .andReturn();

            JsonNode session = readJson(startResult);
            sessionId = UUID.fromString(session.path("sessionId").asText());

            applyLockState(slotId, false, null);

            String expiresOn = LocalDate.now(ZoneOffset.UTC).plusDays(3).toString();
            mockMvc.perform(
                            post("/fridge/bundles")
                                    .header("Authorization", "Bearer " + residentToken)
                                    .contentType(MediaType.APPLICATION_JSON)
                                    .content("""
                                            {
                                              "slotId": "%s",
                                              "bundleName": "점검 중 등록 시도",
                                              "items": [
                                                {
                                                  "name": "테스트 주스",
                                                  "expiryDate": "%s",
                                                  "quantity": 1
                                                }
                                              ]
                                            }
                                            """.formatted(slotId, expiresOn))
                    )
                    .andExpect(status().isLocked())
                    .andExpect(jsonPath("$.code").value("COMPARTMENT_UNDER_INSPECTION"));
        } finally {
            if (sessionId != null) {
                mockMvc.perform(
                                delete("/fridge/inspections/" + sessionId)
                                        .header("Authorization", "Bearer " + managerToken)
                        )
                        .andExpect(status().isNoContent());
            }
            applyLockState(slotId, originalLockState.locked(), originalLockState.lockedUntil());
        }
    }

    @Test
    void adminCannotLowerCapacityBelowActiveBundles() throws Exception {
        String adminToken = loginAndGetAccessToken("dormmate", "admin1!");
        String residentToken = loginAndGetAccessToken(FLOOR2_ROOM05_SLOT1, DEFAULT_PASSWORD);
        UUID slotId = fetchSlotId(FLOOR_2, SLOT_INDEX_A);

        clearSlotBundles(slotId);

        createBundle(residentToken, slotId, "용량검증-1");
        createBundle(residentToken, slotId, "용량검증-2");

        mockMvc.perform(patch("/admin/fridge/compartments/" + slotId)
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "maxBundleCount": 1
                                }
                                """))
                .andExpect(status().isUnprocessableEntity());
    }

    @Test
    void slotViewReflectsCapacityAndStatusChanges() throws Exception {
        String managerToken = loginAndGetAccessToken(FLOOR2_ROOM05_SLOT3, DEFAULT_PASSWORD);
        UUID slotId = fetchSlotId(FLOOR_2, SLOT_INDEX_A);

        Integer originalCapacity = jdbcTemplate.queryForObject(
                "SELECT max_bundle_count FROM fridge_compartment WHERE id = ?",
                Integer.class,
                slotId
        );
        String originalStatus = jdbcTemplate.queryForObject(
                "SELECT status FROM fridge_compartment WHERE id = ?",
                String.class,
                slotId
        );

        int updatedCapacity = (originalCapacity != null ? originalCapacity : 0) + 3;
        String updatedStatus = "ACTIVE".equals(originalStatus) ? "SUSPENDED" : "ACTIVE";

        try {
            jdbcTemplate.update(
                    "UPDATE fridge_compartment SET max_bundle_count = ?, status = ? WHERE id = ?",
                    updatedCapacity,
                    updatedStatus,
                    slotId
            );

            MvcResult result = mockMvc.perform(
                            get("/fridge/slots")
                                    .param("view", "full")
                                    .header("Authorization", "Bearer " + managerToken)
                    )
                    .andExpect(status().isOk())
                    .andReturn();

            JsonNode slots = readJson(result);
            JsonNode slot = findSlot(slots, FLOOR_2, SLOT_INDEX_A);

            assertThat(slot.path("capacity").asInt()).isEqualTo(updatedCapacity);
            assertThat(slot.path("resourceStatus").asText()).isEqualTo(updatedStatus);
        } finally {
            if (originalCapacity != null && originalStatus != null) {
                jdbcTemplate.update(
                        "UPDATE fridge_compartment SET max_bundle_count = ?, status = ? WHERE id = ?",
                        originalCapacity,
                        originalStatus,
                        slotId
                );
            }
        }
    }

    @Test
    void bundleListAndDetailIncludeOwnerAndCounts() throws Exception {
        String aliceToken = loginAndGetAccessToken(FLOOR2_ROOM05_SLOT1, DEFAULT_PASSWORD);
        String managerToken = loginAndGetAccessToken(FLOOR2_ROOM05_SLOT3, DEFAULT_PASSWORD);
        String adminToken = loginAndGetAccessToken("dormmate", "admin1!");
        UUID slotId = fetchSlotId(FLOOR_2, SLOT_INDEX_A);

        clearSlotBundles(slotId);

        String aliceBundleName = "alice-verification-bundle";
        String managerBundleName = "bob-verification-bundle";

        JsonNode aliceBundle = createBundle(aliceToken, slotId, aliceBundleName);
        JsonNode bobBundle = createBundle(managerToken, slotId, managerBundleName);

        UUID aliceBundleId = UUID.fromString(aliceBundle.path("bundle").path("bundleId").asText());
        UUID bobBundleId = UUID.fromString(bobBundle.path("bundle").path("bundleId").asText());

        MvcResult listResult = mockMvc.perform(
                        get("/fridge/bundles")
                                .param("slotId", slotId.toString())
                                .param("owner", "all")
                                .header("Authorization", "Bearer " + adminToken)
                )
                .andExpect(status().isOk())
                .andReturn();

        JsonNode bundleList = readJson(listResult);
        JsonNode summaries = bundleList.path("items");

        JsonNode aliceSummary = findBundleSummaryById(summaries, aliceBundleId);
        JsonNode bobSummary = findBundleSummaryById(summaries, bobBundleId);
        String aliceName = fetchResidentFullName(FLOOR2_ROOM05_SLOT1);
        String bobName = fetchResidentFullName(FLOOR2_ROOM05_SLOT3);

        assertThat(aliceSummary.path("ownerDisplayName").asText()).isEqualTo(aliceName);
        assertThat(aliceSummary.path("itemCount").asInt()).isEqualTo(1);
        assertThat(bobSummary.path("ownerDisplayName").asText()).isEqualTo(bobName);
        assertThat(bobSummary.path("itemCount").asInt()).isEqualTo(1);

        MvcResult detailResult = mockMvc.perform(
                        get("/fridge/bundles/" + aliceBundleId)
                                .header("Authorization", "Bearer " + adminToken)
                )
                .andExpect(status().isOk())
                .andReturn();

        JsonNode detail = readJson(detailResult);
        assertThat(detail.path("bundleName").asText()).isEqualTo(aliceBundleName);
        assertThat(detail.path("ownerDisplayName").asText()).isEqualTo(aliceName);
        assertThat(detail.path("items").isArray()).isTrue();
        assertThat(detail.path("items").size()).isEqualTo(1);
        assertThat(detail.path("items").get(0).path("name").asText()).isNotBlank();
    }

    @Test
    void bundleSearchSupportsMultiLetterSlotCodeAndOwnerRoom() throws Exception {
        String adminToken = loginAndGetAccessToken("dormmate", "admin1!");
        String residentToken = loginAndGetAccessToken(FLOOR2_ROOM05_SLOT1, DEFAULT_PASSWORD);
        UUID slotId = fetchSlotId(FLOOR_2, SLOT_INDEX_A);

        clearSlotBundles(slotId);

        JsonNode created = createBundle(residentToken, slotId, "multi-letter-slot");
        UUID bundleId = UUID.fromString(created.path("bundle").path("bundleId").asText());
        bundlesToCleanup.add(bundleId);

        Integer originalSlotIndex = jdbcTemplate.queryForObject(
                "SELECT slot_index FROM fridge_compartment WHERE id = ?",
                Integer.class,
                slotId
        );
        jdbcTemplate.update("UPDATE fridge_compartment SET slot_index = ? WHERE id = ?", 26, slotId);

        try {
            MvcResult slotTokenResult = mockMvc.perform(
                            get("/fridge/bundles")
                                    .param("owner", "all")
                                    .param("search", "AA")
                                    .header("Authorization", "Bearer " + adminToken)
                    )
                    .andExpect(status().isOk())
                    .andReturn();

            JsonNode slotSummaries = readJson(slotTokenResult).path("items");
            JsonNode slotSummary = findBundleSummaryById(slotSummaries, bundleId);
            assertThat(slotSummary).isNotNull();
            assertThat(slotSummary.path("slotLabel").asText()).isEqualTo("AA");

            String roomSearchToken = jdbcTemplate.queryForObject("""
                    SELECT CONCAT(r.floor, 'F ', r.room_number)
                      FROM room_assignment ra
                      JOIN dorm_user du ON du.id = ra.dorm_user_id
                      JOIN room r ON r.id = ra.room_id
                     WHERE du.login_id = ?
                       AND ra.released_at IS NULL
                    """, String.class, FLOOR2_ROOM05_SLOT1);

            MvcResult roomResult = mockMvc.perform(
                            get("/fridge/bundles")
                                    .param("owner", "all")
                                    .param("search", roomSearchToken)
                                    .header("Authorization", "Bearer " + adminToken)
                    )
                    .andExpect(status().isOk())
                    .andReturn();

            JsonNode roomSummaries = readJson(roomResult).path("items");
            JsonNode roomSummary = findBundleSummaryById(roomSummaries, bundleId);
            assertThat(roomSummary).isNotNull();
            assertThat(roomSummary.path("ownerRoomNumber").asText()).isEqualTo(roomSearchToken);
        } finally {
            if (originalSlotIndex != null) {
                jdbcTemplate.update("UPDATE fridge_compartment SET slot_index = ? WHERE id = ?", originalSlotIndex, slotId);
            }
        }
    }

    @Test
    void deletedBundleListingCanFilterBySlotId() throws Exception {
        String adminToken = loginAndGetAccessToken("dormmate", "admin1!");
        String aliceToken = loginAndGetAccessToken(FLOOR2_ROOM05_SLOT1, DEFAULT_PASSWORD);
        String dianaToken = loginAndGetAccessToken(FLOOR3_ROOM05_SLOT1, DEFAULT_PASSWORD);
        UUID slotFloor2 = fetchSlotId(FLOOR_2, SLOT_INDEX_A);
        UUID slotFloor3 = fetchSlotId(FLOOR_3, SLOT_INDEX_A);

        clearSlotBundles(slotFloor2);
        clearSlotBundles(slotFloor3);

        JsonNode aliceBundle = createBundle(aliceToken, slotFloor2, "slot-2F-deleted");
        UUID aliceBundleId = UUID.fromString(aliceBundle.path("bundle").path("bundleId").asText());
        bundlesToCleanup.add(aliceBundleId);
        mockMvc.perform(
                        delete("/fridge/bundles/" + aliceBundleId)
                                .header("Authorization", "Bearer " + aliceToken)
                )
                .andExpect(status().isNoContent());

        JsonNode dianaBundle = createBundle(dianaToken, slotFloor3, "slot-3F-deleted");
        UUID dianaBundleId = UUID.fromString(dianaBundle.path("bundle").path("bundleId").asText());
        bundlesToCleanup.add(dianaBundleId);
        mockMvc.perform(
                        delete("/fridge/bundles/" + dianaBundleId)
                                .header("Authorization", "Bearer " + dianaToken)
                )
                .andExpect(status().isNoContent());

        String sinceIso = OffsetDateTime.now(ZoneOffset.UTC).minusDays(1).toString();

        MvcResult filteredResult = mockMvc.perform(
                        get("/admin/fridge/bundles/deleted")
                                .param("since", sinceIso)
                                .param("slotId", slotFloor2.toString())
                                .header("Authorization", "Bearer " + adminToken)
                )
                .andExpect(status().isOk())
                .andReturn();

        JsonNode filteredBody = readJson(filteredResult);
        JsonNode filteredItems = filteredBody.path("items");
        assertThat(filteredItems.isArray()).isTrue();
        assertThat(filteredItems.size()).isGreaterThanOrEqualTo(1);
        filteredItems.forEach(item -> assertThat(item.path("slotId").asText()).isEqualTo(slotFloor2.toString()));

        MvcResult unfilteredResult = mockMvc.perform(
                        get("/admin/fridge/bundles/deleted")
                                .param("since", sinceIso)
                                .header("Authorization", "Bearer " + adminToken)
                )
                .andExpect(status().isOk())
                .andReturn();

        JsonNode unfilteredItems = readJson(unfilteredResult).path("items");
        assertThat(unfilteredItems.isArray()).isTrue();
        assertThat(unfilteredItems.size()).isGreaterThanOrEqualTo(filteredItems.size());
        unfilteredItems.forEach(item -> {
            String slotId = item.path("slotId").asText();
            assertThat(slotId).isNotEmpty();
        });
    }

    @Test
    void floorManagerCanViewBundlesWithoutMemo() throws Exception {
        String residentToken = loginAndGetAccessToken(FLOOR2_ROOM05_SLOT1, DEFAULT_PASSWORD);
        String managerToken = loginAndGetAccessToken(FLOOR2_ROOM05_SLOT3, DEFAULT_PASSWORD);
        UUID slotId = fetchSlotId(FLOOR_2, SLOT_INDEX_A);

        clearSlotBundles(slotId);

        String memo = "resident private memo";
        String expiresOn = LocalDate.now(ZoneOffset.UTC).plusDays(3).toString();
        MvcResult createResult = mockMvc.perform(
                        post("/fridge/bundles")
                                .header("Authorization", "Bearer " + residentToken)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("""
                                        {
                                          "slotId": "%s",
                                          "bundleName": "inspection target",
                                          "memo": "%s",
                                          "items": [
                                            {
                                              "name": "라면",
                                              "expiryDate": "%s",
                                              "quantity": 1
                                            }
                                          ]
                                        }
                                        """.formatted(slotId, memo, expiresOn))
                )
                .andExpect(status().isCreated())
                .andReturn();

        JsonNode created = readJson(createResult);
        UUID bundleId = UUID.fromString(created.path("bundle").path("bundleId").asText());
        bundlesToCleanup.add(bundleId);

        MvcResult listResult = mockMvc.perform(
                        get("/fridge/bundles")
                                .param("slotId", slotId.toString())
                                .header("Authorization", "Bearer " + managerToken)
                )
                .andExpect(status().isOk())
                .andReturn();

        JsonNode summaries = readJson(listResult).path("items");
        JsonNode managerSummary = findBundleSummaryById(summaries, bundleId);
        assertThat(managerSummary.has("memo")).isFalse();

        MvcResult detailResult = mockMvc.perform(
                        get("/fridge/bundles/" + bundleId)
                                .header("Authorization", "Bearer " + managerToken)
                )
                .andExpect(status().isOk())
                .andReturn();

        JsonNode detail = readJson(detailResult);
        assertThat(detail.has("memo")).isFalse();
        assertThat(detail.path("bundleName").asText()).isNotBlank();
        assertThat(detail.path("items").isArray()).isTrue();
    }

    @Test
    void adminCanViewAllBundlesButMemoIsHidden() throws Exception {
        String residentToken = loginAndGetAccessToken(FLOOR2_ROOM05_SLOT1, DEFAULT_PASSWORD);
        String adminToken = loginAndGetAccessToken("dormmate", "admin1!");
        UUID slotId = fetchSlotId(FLOOR_2, SLOT_INDEX_A);

        clearSlotBundles(slotId);

        String expiresOn = LocalDate.now(ZoneOffset.UTC).plusDays(5).toString();
        MvcResult createResult = mockMvc.perform(
                        post("/fridge/bundles")
                                .header("Authorization", "Bearer " + residentToken)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("""
                                        {
                                          "slotId": "%s",
                                          "bundleName": "admin visibility target",
                                          "memo": "should not be visible",
                                          "items": [
                                            {
                                              "name": "계란",
                                              "expiryDate": "%s",
                                              "quantity": 3
                                            }
                                          ]
                                        }
                                        """.formatted(slotId, expiresOn))
                )
                .andExpect(status().isCreated())
                .andReturn();

        JsonNode created = readJson(createResult);
        UUID bundleId = UUID.fromString(created.path("bundle").path("bundleId").asText());
        bundlesToCleanup.add(bundleId);

        MvcResult listResult = mockMvc.perform(
                        get("/fridge/bundles")
                                .param("slotId", slotId.toString())
                                .header("Authorization", "Bearer " + adminToken)
                )
                .andExpect(status().isOk())
                .andReturn();

        JsonNode summaries = readJson(listResult).path("items");
        JsonNode adminSummary = findBundleSummaryById(summaries, bundleId);
        assertThat(adminSummary.has("memo")).isFalse();
        assertThat(adminSummary.path("itemCount").asInt()).isEqualTo(1);

        MvcResult detailResult = mockMvc.perform(
                        get("/fridge/bundles/" + bundleId)
                                .header("Authorization", "Bearer " + adminToken)
                )
                .andExpect(status().isOk())
                .andReturn();

        JsonNode detail = readJson(detailResult);
        assertThat(detail.has("memo")).isFalse();
        assertThat(detail.path("items").isArray()).isTrue();
        assertThat(detail.path("items").size()).isEqualTo(1);
    }

    @Test
    void adminBundleSearchSupportsKeywordAndCaseInsensitiveMatch() throws Exception {
        String adminToken = loginAndGetAccessToken("dormmate", "admin1!");
        String residentToken = loginAndGetAccessToken(FLOOR2_ROOM05_SLOT1, DEFAULT_PASSWORD);
        UUID slotId = fetchSlotId(FLOOR_2, SLOT_INDEX_A);

        clearSlotBundles(slotId);

        createBundle(residentToken, slotId, "Alpha Search Bundle");
        createBundle(residentToken, slotId, "beta mix pack");
        createBundle(residentToken, slotId, "Gamma Storage");


        MvcResult result = mockMvc.perform(
                        get("/fridge/bundles")
                                .param("slotId", slotId.toString())
                                .param("owner", "all")
                                .param("search", "ALPHA")
                                .param("page", "0")
                                .param("size", "10")
                                .header("Authorization", "Bearer " + adminToken)
                )
                .andExpect(status().isOk())
                .andReturn();

        JsonNode body = readJson(result);
        assertThat(body.path("totalCount").asInt()).isEqualTo(1);
        JsonNode items = body.path("items");
        assertThat(items.isArray()).isTrue();
        assertThat(items.size()).isEqualTo(1);
        assertThat(items.get(0).path("bundleName").asText()).isEqualTo("Alpha Search Bundle");
    }

    @Test
    void adminBundleSearchSupportsLabelLookup() throws Exception {
        String adminToken = loginAndGetAccessToken("dormmate", "admin1!");
        String residentToken = loginAndGetAccessToken(FLOOR2_ROOM05_SLOT1, DEFAULT_PASSWORD);
        UUID slotId = fetchSlotId(FLOOR_2, SLOT_INDEX_A);

        clearSlotBundles(slotId);

        JsonNode firstBundle = createBundle(residentToken, slotId, "Label Base One");
        JsonNode secondBundle = createBundle(residentToken, slotId, "Label Focus Two");

        String targetLabel = secondBundle.path("bundle").path("labelDisplay").asText();

        MvcResult result = mockMvc.perform(
                        get("/fridge/bundles")
                                .param("slotId", slotId.toString())
                                .param("owner", "all")
                                .param("search", targetLabel.toLowerCase())
                                .header("Authorization", "Bearer " + adminToken)
                )
                .andExpect(status().isOk())
                .andReturn();

        JsonNode body = readJson(result);
        assertThat(body.path("totalCount").asInt()).isEqualTo(1);
        JsonNode item = body.path("items").get(0);
        assertThat(item.path("bundleId").asText()).isEqualTo(secondBundle.path("bundle").path("bundleId").asText());
        assertThat(item.path("labelDisplay").asText()).isEqualTo(targetLabel);
    }

    @Test
    void adminBundleListWithDeletedFilterReturnsOnlyDeletedBundles() throws Exception {
        String adminToken = loginAndGetAccessToken("dormmate", "admin1!");
        String residentToken = loginAndGetAccessToken(FLOOR2_ROOM05_SLOT1, DEFAULT_PASSWORD);
        UUID slotId = fetchSlotId(FLOOR_2, SLOT_INDEX_A);

        clearSlotBundles(slotId);

        JsonNode activeBundle = createBundle(residentToken, slotId, "Active bundle snapshot");
        JsonNode deletedBundle = createBundle(residentToken, slotId, "Deleted bundle snapshot");
        UUID deletedBundleId = UUID.fromString(deletedBundle.path("bundle").path("bundleId").asText());

        mockMvc.perform(
                        delete("/fridge/bundles/" + deletedBundleId)
                                .header("Authorization", "Bearer " + residentToken)
                )
                .andExpect(status().isNoContent());

        MvcResult result = mockMvc.perform(
                        get("/fridge/bundles")
                                .param("slotId", slotId.toString())
                                .param("owner", "all")
                                .param("status", "deleted")
                                .header("Authorization", "Bearer " + adminToken)
                )
                .andExpect(status().isOk())
                .andReturn();

        JsonNode body = readJson(result);
        assertThat(body.path("totalCount").asInt()).isEqualTo(1);
        JsonNode item = body.path("items").get(0);
        assertThat(item.path("bundleId").asText()).isEqualTo(deletedBundleId.toString());
        assertThat(item.path("status").asText()).isEqualTo("DELETED");

        // sanity check that active bundle remains active when fetching default view
        MvcResult activeResult = mockMvc.perform(
                        get("/fridge/bundles")
                                .param("slotId", slotId.toString())
                                .header("Authorization", "Bearer " + adminToken)
                )
                .andExpect(status().isOk())
                .andReturn();
        JsonNode activeBody = readJson(activeResult);
        assertThat(activeBody.path("items").findValuesAsText("bundleId"))
                .contains(activeBundle.path("bundle").path("bundleId").asText());
    }
    @Test
    void residentCannotAccessDeletedBundleHistory() throws Exception {
        String residentToken = loginAndGetAccessToken(FLOOR2_ROOM05_SLOT1, DEFAULT_PASSWORD);

        mockMvc.perform(
                        get("/admin/fridge/bundles/deleted")
                                .header("Authorization", "Bearer " + residentToken)
                )
                .andExpect(status().isForbidden());
    }

    @Test
    void adminGetsDeletedBundlesWithinDefaultWindow() throws Exception {
        String adminToken = loginAndGetAccessToken("dormmate", "admin1!");
        String residentToken = loginAndGetAccessToken(FLOOR2_ROOM05_SLOT1, DEFAULT_PASSWORD);
        UUID slotId = fetchSlotId(FLOOR_2, SLOT_INDEX_A);

        clearSlotBundles(slotId);

        JsonNode recentBundle = createBundle(residentToken, slotId, "recent bundle");
        UUID recentBundleId = UUID.fromString(recentBundle.path("bundle").path("bundleId").asText());

        mockMvc.perform(
                        delete("/fridge/bundles/" + recentBundleId)
                                .header("Authorization", "Bearer " + residentToken)
                )
                .andExpect(status().isNoContent());

        JsonNode oldBundle = createBundle(residentToken, slotId, "old bundle");
        UUID oldBundleId = UUID.fromString(oldBundle.path("bundle").path("bundleId").asText());

        mockMvc.perform(
                        delete("/fridge/bundles/" + oldBundleId)
                                .header("Authorization", "Bearer " + residentToken)
                )
                .andExpect(status().isNoContent());

        OffsetDateTime fourMonthsAgo = OffsetDateTime.now(ZoneOffset.UTC).minusMonths(4);
        overrideDeletedAt(oldBundleId, fourMonthsAgo);

        MvcResult defaultWindowResult = mockMvc.perform(
                        get("/admin/fridge/bundles/deleted")
                                .header("Authorization", "Bearer " + adminToken)
                                .param("size", "10")
                )
                .andExpect(status().isOk())
                .andReturn();

        JsonNode defaultResponse = readJson(defaultWindowResult);
        assertThat(defaultResponse.path("totalCount").asInt()).isEqualTo(1);
        JsonNode items = defaultResponse.path("items");
        assertThat(items.isArray()).isTrue();
        assertThat(items.size()).isEqualTo(1);
        assertThat(items.get(0).path("bundleId").asText()).isEqualTo(recentBundleId.toString());

        MvcResult extendedWindowResult = mockMvc.perform(
                        get("/admin/fridge/bundles/deleted")
                                .header("Authorization", "Bearer " + adminToken)
                                .param("since", fourMonthsAgo.minusWeeks(1).toString())
                                .param("size", "10")
                )
                .andExpect(status().isOk())
                .andReturn();

        JsonNode extendedResponse = readJson(extendedWindowResult);
        assertThat(extendedResponse.path("totalCount").asInt()).isEqualTo(2);
        List<String> bundleIds = new ArrayList<>();
        extendedResponse.path("items").forEach(node -> bundleIds.add(node.path("bundleId").asText()));
        assertThat(bundleIds).containsExactlyInAnyOrder(recentBundleId.toString(), oldBundleId.toString());
    }

    @Test
    void residentSeesOnlyAssignedSlots() throws Exception {
        assertAccessibleSlotsMatch(FLOOR2_ROOM05_SLOT1, DEFAULT_PASSWORD);
    }

    @Test
    void floorManagerSeesAllSlotsOnAssignedFloor() throws Exception {
        String loginId = FLOOR2_ROOM05_SLOT3;
        String password = DEFAULT_PASSWORD;

        UUID managerId = jdbcTemplate.queryForObject(
                "SELECT id FROM dorm_user WHERE login_id = ?",
                (rs, rowNum) -> UUID.fromString(rs.getString("id")),
                loginId
        );

        int managedFloor = jdbcTemplate.queryForObject(
                """
                        SELECT r.floor
                        FROM room_assignment ra
                        JOIN room r ON r.id = ra.room_id
                        WHERE ra.dorm_user_id = ?
                          AND ra.released_at IS NULL
                        """,
                Integer.class,
                managerId
        );

        List<UUID> expectedSlotIds = jdbcTemplate.query(
                """
                        SELECT fc.id
                        FROM fridge_compartment fc
                        JOIN fridge_unit fu ON fu.id = fc.fridge_unit_id
                        WHERE fu.floor_no = ?
                        """,
                (rs, rowNum) -> UUID.fromString(rs.getString("id")),
                managedFloor
        );
        assertThat(expectedSlotIds).isNotEmpty();

        String accessToken = loginAndGetAccessToken(loginId, password);

        assertSlotsMatchExpected(accessToken, null, expectedSlotIds);
        assertSlotsMatchExpected(accessToken, managedFloor, expectedSlotIds);
    }

    @Test
    void floorManagerCannotAccessOtherFloors() throws Exception {
        String loginId = FLOOR2_ROOM05_SLOT3;
        String password = DEFAULT_PASSWORD;
        String accessToken = loginAndGetAccessToken(loginId, password);

        UUID managerId = jdbcTemplate.queryForObject(
                "SELECT id FROM dorm_user WHERE login_id = ?",
                (rs, rowNum) -> UUID.fromString(rs.getString("id")),
                loginId
        );

        int managedFloor = jdbcTemplate.queryForObject(
                """
                        SELECT r.floor
                        FROM room_assignment ra
                        JOIN room r ON r.id = ra.room_id
                        WHERE ra.dorm_user_id = ?
                          AND ra.released_at IS NULL
                        """,
                Integer.class,
                managerId
        );

        int otherFloor = managedFloor == 2 ? 3 : 2;

        mockMvc.perform(
                        get("/fridge/slots")
                                .param("floor", String.valueOf(otherFloor))
                                .header("Authorization", "Bearer " + accessToken)
                )
                .andExpect(status().isForbidden());
    }

    @Test
    void deletingBundleRecyclesLabelForNextCreation() throws Exception {
        String managerToken = loginAndGetAccessToken("dormmate", "admin1!");
        UUID slotId = fetchSlotId(4, SLOT_INDEX_A);

        LabelSequenceState originalLabelState = jdbcTemplate.query(
                """
                        SELECT next_number, recycled_numbers::text AS recycled_numbers
                        FROM bundle_label_sequence
                        WHERE fridge_compartment_id = ?
                        """,
                singleLabelState(),
                slotId
        );

        clearSlotBundles(slotId);

        try {
            JsonNode firstBundle = createBundle(managerToken, slotId, "라벨 재사용 검증 1");
            UUID firstBundleId = UUID.fromString(firstBundle.path("bundle").path("bundleId").asText());
            int initialLabelNumber = firstBundle.path("bundle").path("labelNumber").asInt();

            mockMvc.perform(
                            delete("/fridge/bundles/" + firstBundleId)
                                    .header("Authorization", "Bearer " + managerToken)
                    )
                    .andExpect(status().isNoContent());

            JsonNode secondBundle = createBundle(managerToken, slotId, "라벨 재사용 검증 2");
            int reusedLabelNumber = secondBundle.path("bundle").path("labelNumber").asInt();

            assertThat(reusedLabelNumber).isEqualTo(initialLabelNumber);

            LabelSequenceState afterState = jdbcTemplate.query(
                    """
                            SELECT next_number, recycled_numbers::text AS recycled_numbers
                            FROM bundle_label_sequence
                            WHERE fridge_compartment_id = ?
                            """,
                    singleLabelState(),
                    slotId
            );
            assertThat(afterState).isNotNull();
            JsonNode recycled = objectMapper.readTree(
                    Optional.ofNullable(afterState.recycledNumbers()).orElse("[]")
            );
            assertThat(recycled.isArray()).isTrue();
            assertThat(recycled.size()).isZero();
        } finally {
            clearSlotBundles(slotId);
            restoreLabelSequence(slotId, originalLabelState);
        }
    }

    @Test
    void deleteBundleFailsForUnauthorizedUser() throws Exception {
        String ownerToken = loginAndGetAccessToken(FLOOR2_ROOM05_SLOT1, DEFAULT_PASSWORD);
        String otherResidentToken = loginAndGetAccessToken(FLOOR2_ROOM17_SLOT2, DEFAULT_PASSWORD);
        UUID slotId = fetchSlotId(FLOOR_2, SLOT_INDEX_A);

        clearSlotBundles(slotId);

        JsonNode bundleResponse = createBundle(ownerToken, slotId, "delete-forbidden-test");
        UUID bundleId = UUID.fromString(bundleResponse.path("bundle").path("bundleId").asText());

        mockMvc.perform(
                        delete("/fridge/bundles/" + bundleId)
                                .header("Authorization", "Bearer " + otherResidentToken)
                )
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN_SLOT"));

        // bundle should remain active after failed deletion
        JsonNode bundleDetail = objectMapper.readTree(
                mockMvc.perform(
                                get("/fridge/bundles/" + bundleId)
                                        .header("Authorization", "Bearer " + ownerToken)
                        )
                        .andExpect(status().isOk())
                        .andReturn()
                        .getResponse()
                        .getContentAsString());
        assertThat(bundleDetail.path("status").asText()).isEqualTo("ACTIVE");
    }

    @Test
    void deleteBundleFailsWhenLocked() throws Exception {
        String ownerToken = loginAndGetAccessToken(FLOOR2_ROOM05_SLOT1, DEFAULT_PASSWORD);
        UUID slotId = fetchSlotId(FLOOR_2, SLOT_INDEX_A);

        clearSlotBundles(slotId);

        JsonNode bundleResponse = createBundle(ownerToken, slotId, "delete-locked-test");
        UUID bundleId = UUID.fromString(bundleResponse.path("bundle").path("bundleId").asText());

        LockState originalLock = fetchLockState(slotId);
        applyLockState(slotId, true, OffsetDateTime.now(ZoneOffset.UTC).plusMinutes(30));
        try {
            mockMvc.perform(
                            delete("/fridge/bundles/" + bundleId)
                                    .header("Authorization", "Bearer " + ownerToken)
                    )
                    .andExpect(status().isLocked())
                    .andExpect(jsonPath("$.code").value("COMPARTMENT_LOCKED"));
        } finally {
            applyLockState(slotId, originalLock.locked(), originalLock.lockedUntil());
        }
    }

    @Test
    void residentCanMarkItemAsRemoved() throws Exception {
        String accessToken = loginAndGetAccessToken(FLOOR2_ROOM05_SLOT1, DEFAULT_PASSWORD);
        UUID slotId = fetchSlotId(FLOOR_2, SLOT_INDEX_A);

        clearSlotBundles(slotId);

        JsonNode bundleResponse = createBundle(accessToken, slotId, "미등록 처리 테스트");
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
            assertThat(item.getStatus()).isEqualTo(FridgeItemStatus.DELETED);
            assertThat(item.getDeletedAt()).isNotNull();
        });
    }

    private JsonNode createBundle(String accessToken, UUID slotId, String bundleName) throws Exception {
        String expiresOn = LocalDate.now(ZoneOffset.UTC).plusDays(4).toString();
        MvcResult result = mockMvc.perform(
                        post("/fridge/bundles")
                                .header("Authorization", "Bearer " + accessToken)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("""
                                        {
                                          "slotId": "%s",
                                          "bundleName": "%s",
                                          "items": [
                                            {
                                              "name": "테스트 식품",
                                              "expiryDate": "%s",
                                              "quantity": 1
                                            }
                                          ]
                                        }
                                        """.formatted(slotId, bundleName, expiresOn))
                )
                .andExpect(status().isCreated())
                .andReturn();
        String ownerLogin = tokenOwners.get(accessToken);
        if (ownerLogin != null && !"dormmate".equalsIgnoreCase(ownerLogin)) {
            ensureResidentHasAccess(ownerLogin, slotId);
        }
        JsonNode bundle = readJson(result);
        bundlesToCleanup.add(UUID.fromString(bundle.path("bundle").path("bundleId").asText()));
        return bundle;
    }

    private String fetchResidentFullName(String loginId) {
        return jdbcTemplate.queryForObject(
                "SELECT full_name FROM dorm_user WHERE login_id = ?",
                String.class,
                loginId
        );
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
        JsonNode response = readJson(result);
        String token = response.path("tokens").path("accessToken").asText();
        tokenOwners.put(token, loginId);
        return token;
    }

    private JsonNode readJson(MvcResult result) throws Exception {
        return objectMapper.readTree(result.getResponse().getContentAsByteArray());
    }

    private JsonNode readJson(MockHttpServletResponse response) throws Exception {
        return objectMapper.readTree(response.getContentAsByteArray());
    }

    private JsonNode findSlot(JsonNode root, int floorNo, int slotIndex) {
        JsonNode items = root.isArray() ? root : root.path("items");
        for (JsonNode slot : items) {
            if (slot.path("floorNo").asInt() == floorNo && slot.path("slotIndex").asInt() == slotIndex) {
                return slot;
            }
        }
        throw new AssertionError("slot not found: floor=%d slot=%d".formatted(floorNo, slotIndex));
    }

    private JsonNode findBundleSummaryById(JsonNode summaries, UUID bundleId) {
        for (JsonNode summary : summaries) {
            if (summary.path("bundleId").asText().equals(bundleId.toString())) {
                return summary;
            }
        }
        throw new AssertionError("bundle summary not found: " + bundleId);
    }

    private void clearSlotBundles(UUID slotId) {
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

    private void overrideDeletedAt(UUID bundleId, OffsetDateTime deletedAt) {
        jdbcTemplate.update(
                "UPDATE fridge_bundle SET deleted_at = ?, updated_at = GREATEST(updated_at, ?) WHERE id = ?",
                ps -> {
                    ps.setObject(1, deletedAt);
                    ps.setObject(2, deletedAt);
                    ps.setObject(3, bundleId);
                }
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

    private ResultSetExtractor<LabelSequenceState> singleLabelState() {
        return rs -> rs.next() ? mapLabelState(rs) : null;
    }

    private LabelSequenceState mapLabelState(ResultSet rs) throws SQLException {
        int nextNumber = rs.getInt("next_number");
        String recycled = rs.getString("recycled_numbers");
        return new LabelSequenceState(nextNumber, recycled);
    }

    private void restoreLabelSequence(UUID slotId, LabelSequenceState state) {
        if (state == null) {
            jdbcTemplate.update(
                    "DELETE FROM bundle_label_sequence WHERE fridge_compartment_id = ?",
                    slotId
            );
        } else {
            jdbcTemplate.update(
                    "UPDATE bundle_label_sequence SET next_number = ?, recycled_numbers = ?::jsonb WHERE fridge_compartment_id = ?",
                    state.nextNumber(),
                    Optional.ofNullable(state.recycledNumbers()).orElse("[]"),
                    slotId
            );
        }
    }

    private LockState fetchLockState(UUID slotId) {
        return jdbcTemplate.queryForObject(
                "SELECT is_locked, locked_until FROM fridge_compartment WHERE id = ?",
                (rs, rowNum) -> new LockState(
                        rs.getBoolean("is_locked"),
                        rs.getObject("locked_until", OffsetDateTime.class)
                ),
                slotId
        );
    }

    private void applyLockState(UUID slotId, boolean locked, OffsetDateTime lockedUntil) {
        jdbcTemplate.update(
                "UPDATE fridge_compartment SET is_locked = ?, locked_until = ? WHERE id = ?",
                ps -> {
                    ps.setBoolean(1, locked);
                    if (lockedUntil != null) {
                        ps.setObject(2, lockedUntil);
                    } else {
                        ps.setNull(2, Types.TIMESTAMP_WITH_TIMEZONE);
                    }
                    ps.setObject(3, slotId);
                }
        );
    }

    private void assertAccessibleSlotsMatch(String loginId, String password) throws Exception {
        UUID userId = jdbcTemplate.queryForObject(
                "SELECT id FROM dorm_user WHERE login_id = ?",
                (rs, rowNum) -> UUID.fromString(rs.getString("id")),
                loginId
        );
        List<UUID> accessibleSlotIds = jdbcTemplate.query(
                """
                        SELECT DISTINCT cra.fridge_compartment_id
                        FROM room_assignment ra
                        JOIN compartment_room_access cra ON cra.room_id = ra.room_id
                        WHERE ra.dorm_user_id = ?
                          AND ra.released_at IS NULL
                          AND cra.released_at IS NULL
                        """,
                (rs, rowNum) -> UUID.fromString(rs.getString("fridge_compartment_id")),
                userId
        );

        assertThat(accessibleSlotIds).isNotEmpty();

        String accessToken = loginAndGetAccessToken(loginId, password);
        MvcResult response = mockMvc.perform(
                        get("/fridge/slots")
                                .header("Authorization", "Bearer " + accessToken)
                )
                .andExpect(status().isOk())
                .andReturn();

        JsonNode body = readJson(response);
        JsonNode slots = body.path("items");
        assertThat(slots.isArray()).isTrue();

        assertThat(body.path("totalCount").asInt()).isGreaterThan(0);
        List<UUID> slotIdsFromApi = new ArrayList<>();
        for (JsonNode slot : slots) {
            slotIdsFromApi.add(UUID.fromString(slot.path("slotId").asText()));
        }

        assertThat(slotIdsFromApi).containsExactlyInAnyOrderElementsOf(Set.copyOf(accessibleSlotIds));
    }

    private void ensureResidentHasAccess(String loginId, UUID compartmentId) {
        UUID userId = fetchUserId(loginId);
        UUID roomId = fetchActiveRoomId(userId);
        Integer existing = jdbcTemplate.queryForObject(
                """
                        SELECT COUNT(*)
                        FROM compartment_room_access
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

    private UUID fetchUserId(String loginId) {
        return jdbcTemplate.queryForObject(
                "SELECT id FROM dorm_user WHERE login_id = ?",
                (rs, rowNum) -> UUID.fromString(rs.getString("id")),
                loginId
        );
    }

    private UUID fetchActiveRoomId(UUID userId) {
        return jdbcTemplate.queryForObject(
                """
                        SELECT room_id
                        FROM room_assignment
                        WHERE dorm_user_id = ?
                          AND released_at IS NULL
                        """,
                (rs, rowNum) -> UUID.fromString(rs.getString("room_id")),
                userId
        );
    }

    private void assertSlotsMatchExpected(String accessToken, Integer floor, List<UUID> expectedSlotIds) throws Exception {
        var requestBuilder = get("/fridge/slots")
                .header("Authorization", "Bearer " + accessToken);
        if (floor != null) {
            requestBuilder.param("floor", String.valueOf(floor));
        }

        MvcResult response = mockMvc.perform(requestBuilder)
                .andExpect(status().isOk())
                .andReturn();

        JsonNode body = readJson(response);
        JsonNode slots = body.path("items");
        assertThat(slots.isArray()).isTrue();

        List<UUID> slotIdsFromApi = new ArrayList<>();
        for (JsonNode slot : slots) {
            slotIdsFromApi.add(UUID.fromString(slot.path("slotId").asText()));
        }

        assertThat(slotIdsFromApi).containsExactlyInAnyOrderElementsOf(Set.copyOf(expectedSlotIds));
    }

    private record LabelSequenceState(int nextNumber, String recycledNumbers) {
    }

    private record LockState(boolean locked, OffsetDateTime lockedUntil) {
    }
}

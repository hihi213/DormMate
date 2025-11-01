package com.dormmate.backend.modules.fridge;

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
import java.util.UUID;
import java.util.Set;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.ResultSetExtractor;
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

    @AfterEach
    void tearDown() {
        bundlesToCleanup.forEach(id -> fridgeBundleRepository.findById(id)
                .ifPresent(fridgeBundleRepository::delete));
        bundlesToCleanup.clear();
    }

    @Test
    void residentCannotCreateBundleOutsideAssignedSlot() throws Exception {
        String accessToken = loginAndGetAccessToken("alice", "alice123!");
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
        String accessToken = loginAndGetAccessToken("alice", "alice123!");
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

        jdbcTemplate.update(
                "DELETE FROM fridge_item WHERE fridge_bundle_id IN (SELECT id FROM fridge_bundle WHERE fridge_compartment_id = ?)",
                slotId
        );
        jdbcTemplate.update(
                "DELETE FROM fridge_bundle WHERE fridge_compartment_id = ?",
                slotId
        );
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
    void adminCanUpdateCompartmentConfigViaApi() throws Exception {
        String adminToken = loginAndGetAccessToken("admin", "password");
        String residentToken = loginAndGetAccessToken("alice", "alice123!");
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
        String accessToken = loginAndGetAccessToken("alice", "alice123!");
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
        String managerToken = loginAndGetAccessToken("bob", "bob123!");
        String residentToken = loginAndGetAccessToken("alice", "alice123!");
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

            JsonNode session = objectMapper.readTree(startResult.getResponse().getContentAsString());
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
        String adminToken = loginAndGetAccessToken("admin", "password");
        String residentToken = loginAndGetAccessToken("alice", "alice123!");
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
        String managerToken = loginAndGetAccessToken("bob", "bob123!");
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

            JsonNode slots = objectMapper.readTree(result.getResponse().getContentAsString());
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
        String aliceToken = loginAndGetAccessToken("alice", "alice123!");
        String managerToken = loginAndGetAccessToken("bob", "bob123!");
        String adminToken = loginAndGetAccessToken("admin", "password");
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
                                .header("Authorization", "Bearer " + adminToken)
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
    void floorManagerCanViewBundlesWithoutMemo() throws Exception {
        String residentToken = loginAndGetAccessToken("alice", "alice123!");
        String managerToken = loginAndGetAccessToken("bob", "bob123!");
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

        JsonNode created = objectMapper.readTree(createResult.getResponse().getContentAsString());
        UUID bundleId = UUID.fromString(created.path("bundle").path("bundleId").asText());
        bundlesToCleanup.add(bundleId);

        MvcResult listResult = mockMvc.perform(
                        get("/fridge/bundles")
                                .param("slotId", slotId.toString())
                                .header("Authorization", "Bearer " + managerToken)
                )
                .andExpect(status().isOk())
                .andReturn();

        JsonNode summaries = objectMapper.readTree(listResult.getResponse().getContentAsString()).path("items");
        JsonNode managerSummary = findBundleSummaryById(summaries, bundleId);
        assertThat(managerSummary.has("memo")).isFalse();

        MvcResult detailResult = mockMvc.perform(
                        get("/fridge/bundles/" + bundleId)
                                .header("Authorization", "Bearer " + managerToken)
                )
                .andExpect(status().isOk())
                .andReturn();

        JsonNode detail = objectMapper.readTree(detailResult.getResponse().getContentAsString());
        assertThat(detail.has("memo")).isFalse();
        assertThat(detail.path("bundleName").asText()).isNotBlank();
        assertThat(detail.path("items").isArray()).isTrue();
    }

    @Test
    void adminCanViewAllBundlesButMemoIsHidden() throws Exception {
        String residentToken = loginAndGetAccessToken("alice", "alice123!");
        String adminToken = loginAndGetAccessToken("admin", "password");
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

        JsonNode created = objectMapper.readTree(createResult.getResponse().getContentAsString());
        UUID bundleId = UUID.fromString(created.path("bundle").path("bundleId").asText());
        bundlesToCleanup.add(bundleId);

        MvcResult listResult = mockMvc.perform(
                        get("/fridge/bundles")
                                .param("slotId", slotId.toString())
                                .header("Authorization", "Bearer " + adminToken)
                )
                .andExpect(status().isOk())
                .andReturn();

        JsonNode summaries = objectMapper.readTree(listResult.getResponse().getContentAsString()).path("items");
        JsonNode adminSummary = findBundleSummaryById(summaries, bundleId);
        assertThat(adminSummary.has("memo")).isFalse();
        assertThat(adminSummary.path("itemCount").asInt()).isEqualTo(1);

        MvcResult detailResult = mockMvc.perform(
                        get("/fridge/bundles/" + bundleId)
                                .header("Authorization", "Bearer " + adminToken)
                )
                .andExpect(status().isOk())
                .andReturn();

        JsonNode detail = objectMapper.readTree(detailResult.getResponse().getContentAsString());
        assertThat(detail.has("memo")).isFalse();
        assertThat(detail.path("items").isArray()).isTrue();
        assertThat(detail.path("items").size()).isEqualTo(1);
    }

    @Test
    void residentSeesOnlyAssignedSlots() throws Exception {
        assertAccessibleSlotsMatch("alice", "alice123!");
    }

    @Test
    void floorManagerSeesAllSlotsOnAssignedFloor() throws Exception {
        String loginId = "bob";
        String password = "bob123!";

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
        String loginId = "bob";
        String password = "bob123!";
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
        String managerToken = loginAndGetAccessToken("admin", "password");
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
    void residentCanMarkItemAsRemoved() throws Exception {
        String accessToken = loginAndGetAccessToken("alice", "alice123!");
        UUID slotId = fetchSlotId(FLOOR_2, SLOT_INDEX_A);

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

        JsonNode body = objectMapper.readTree(response.getResponse().getContentAsString());
        JsonNode slots = body.path("items");
        assertThat(slots.isArray()).isTrue();

        assertThat(body.path("totalCount").asInt()).isGreaterThan(0);
        List<UUID> slotIdsFromApi = new ArrayList<>();
        for (JsonNode slot : slots) {
            slotIdsFromApi.add(UUID.fromString(slot.path("slotId").asText()));
        }

        assertThat(slotIdsFromApi).containsExactlyInAnyOrderElementsOf(Set.copyOf(accessibleSlotIds));
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

        JsonNode body = objectMapper.readTree(response.getResponse().getContentAsString());
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

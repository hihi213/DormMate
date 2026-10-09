package com.dormmate.backend.modules.fridge;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDate;
import java.util.UUID;

import com.dormmate.backend.support.AbstractPostgresIntegrationTest;
import com.dormmate.backend.support.TestUserFactory;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import org.junit.jupiter.api.DisplayName;
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
class FridgeApiFlowIntegrationTest extends AbstractPostgresIntegrationTest {

    private static final String LOGIN_ID = "205-1";
    private static final String PASSWORD = "user2025!";
    private static final String DEVICE_ID = "resident-device-e2e";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private TestUserFactory testUserFactory;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    @DisplayName("실제 API 기반 로그인부터 냉장고 슬롯 조회, 포장/물품 등록, 수정, 삭제의 기본 흐름이 정상 통과한다")
    void realApiLoginAndFridgeFullCrudFlow() throws Exception {
        // 1. 사용자 생성 및 배정
        var user = testUserFactory.ensureResident(LOGIN_ID, PASSWORD, (short) 2, "205", (short) 1);
        testUserFactory.ensureRole("RESIDENT", "입주자");
        testUserFactory.grantRole(user, "RESIDENT");

        UUID slotId = fetchSlotId(2, 0);
        ensureResidentHasAccess(LOGIN_ID, slotId);

        // 2. 실제 API 로그인: POST /auth/login
        MvcResult loginResult = mockMvc.perform(
                post("/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "loginId": "%s",
                                  "password": "%s",
                                  "deviceId": "%s"
                                }
                                """.formatted(LOGIN_ID, PASSWORD, DEVICE_ID))
        )
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.tokens.accessToken").isNotEmpty())
        .andExpect(jsonPath("$.tokens.refreshToken").isNotEmpty())
        .andExpect(jsonPath("$.user.loginId").value(LOGIN_ID))
        .andReturn();

        JsonNode loginJson = objectMapper.readTree(loginResult.getResponse().getContentAsString());
        String accessToken = loginJson.path("tokens").path("accessToken").asText();

        // 3. 내 프로필 조회: GET /profile/me
        mockMvc.perform(
                get("/profile/me")
                        .header("Authorization", "Bearer " + accessToken)
        )
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.loginId").value(LOGIN_ID))
        .andExpect(jsonPath("$.primaryRoom.roomNumber").value("05"));

        // 4. 배정 칸 목록 조회: GET /fridge/slots
        MvcResult slotsResult = mockMvc.perform(
                get("/fridge/slots")
                        .header("Authorization", "Bearer " + accessToken)
        )
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.items").isArray())
        .andExpect(jsonPath("$.items.length()").value(org.hamcrest.Matchers.greaterThan(0)))
        .andReturn();

        JsonNode slotsJson = objectMapper.readTree(slotsResult.getResponse().getContentAsString());
        String assignedSlotId = slotsJson.path("items").get(0).path("id").asText();
        assertThat(assignedSlotId).isEqualTo(slotId.toString());

        // 5. 포장 및 물품 등록: POST /fridge/bundles
        String expiryDate = LocalDate.now().plusDays(7).toString();
        MvcResult createBundleResult = mockMvc.perform(
                post("/fridge/bundles")
                        .header("Authorization", "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "slotId": "%s",
                                  "bundleName": "신선 과일 세트",
                                  "memo": "사과와 귤 보관",
                                  "items": [
                                    {
                                      "itemName": "사과",
                                      "quantity": 3,
                                      "unitCode": "EA",
                                      "expiryDate": "%s"
                                    },
                                    {
                                      "itemName": "귤",
                                      "quantity": 1,
                                      "unitCode": "PACK",
                                      "expiryDate": "%s"
                                    }
                                  ]
                                }
                                """.formatted(slotId, expiryDate, expiryDate))
        )
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.bundle.bundleId").isNotEmpty())
        .andExpect(jsonPath("$.bundle.labelDisplay").isNotEmpty())
        .andExpect(jsonPath("$.bundle.bundleName").value("신선 과일 세트"))
        .andReturn();

        JsonNode bundleJson = objectMapper.readTree(createBundleResult.getResponse().getContentAsString());
        String bundleId = bundleJson.path("bundle").path("bundleId").asText();
        String labelDisplay = bundleJson.path("bundle").path("labelDisplay").asText();
        assertThat(labelDisplay).matches("\\d{3}");

        // 6. 포장 단건 및 목록 조회: GET /fridge/bundles/{bundleId}
        MvcResult getBundleResult = mockMvc.perform(
                get("/fridge/bundles/" + bundleId)
                        .header("Authorization", "Bearer " + accessToken)
        )
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.bundleId").value(bundleId))
        .andExpect(jsonPath("$.bundleName").value("신선 과일 세트"))
        .andExpect(jsonPath("$.memo").value("사과와 귤 보관"))
        .andExpect(jsonPath("$.items.length()").value(2))
        .andReturn();

        JsonNode bundleDetail = objectMapper.readTree(getBundleResult.getResponse().getContentAsString());
        String firstItemId = bundleDetail.path("items").get(0).path("itemId").asText();

        // 7. 물품 수정: PATCH /fridge/items/{itemId}
        String extendedExpiry = LocalDate.now().plusDays(14).toString();
        mockMvc.perform(
                patch("/fridge/items/" + firstItemId)
                        .header("Authorization", "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "quantity": 5,
                                  "expiryDate": "%s"
                                }
                                """.formatted(extendedExpiry))
        )
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.itemId").value(firstItemId))
        .andExpect(jsonPath("$.quantity").value(5))
        .andExpect(jsonPath("$.expiryDate").value(extendedExpiry));

        // 8. 포장 삭제: DELETE /fridge/bundles/{bundleId}
        mockMvc.perform(
                delete("/fridge/bundles/" + bundleId)
                        .header("Authorization", "Bearer " + accessToken)
        )
        .andExpect(status().isNoContent());

        // 삭제 후 조회 시 ACTIVE 목록에서 제외 확인
        mockMvc.perform(
                get("/fridge/bundles")
                        .header("Authorization", "Bearer " + accessToken)
                        .param("slotId", slotId.toString())
                        .param("status", "ACTIVE")
        )
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.items[?(@.bundleId == '" + bundleId + "')]").doesNotExist());
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

    private void ensureResidentHasAccess(String loginId, UUID compartmentId) {
        UUID userId = jdbcTemplate.queryForObject(
                "SELECT id FROM dorm_user WHERE lower(login_id) = lower(?)", UUID.class, loginId);
        UUID roomId = jdbcTemplate.queryForObject(
                "SELECT room_id FROM room_assignment WHERE dorm_user_id = ? AND released_at IS NULL", UUID.class, userId);
        Integer existing = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM compartment_room_access WHERE room_id = ? AND fridge_compartment_id = ? AND released_at IS NULL",
                Integer.class, roomId, compartmentId);
        if (existing == null || existing == 0) {
            jdbcTemplate.update("""
                    INSERT INTO compartment_room_access (id, fridge_compartment_id, room_id, assigned_at, created_at, updated_at)
                    VALUES (gen_random_uuid(), ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                    """, compartmentId, roomId);
        }
    }
}

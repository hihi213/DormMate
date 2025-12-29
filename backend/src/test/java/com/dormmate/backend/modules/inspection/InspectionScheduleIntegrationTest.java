package com.dormmate.backend.modules.inspection;

import static com.dormmate.backend.support.TestResidentAccounts.DEFAULT_PASSWORD;
import static com.dormmate.backend.support.TestResidentAccounts.FLOOR2_ROOM05_SLOT1;
import static com.dormmate.backend.support.TestResidentAccounts.FLOOR2_ROOM05_SLOT3;
import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.dormmate.backend.support.AbstractPostgresIntegrationTest;
import com.dormmate.backend.support.TestUserFactory;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
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
class InspectionScheduleIntegrationTest extends AbstractPostgresIntegrationTest {

    private static final int FLOOR_2 = 2;
    private static final int SLOT_INDEX_A = 0;
    private static final String TARGET_RESIDENT_LOGIN = FLOOR2_ROOM05_SLOT1;
    private static final String ADMIN_LOGIN_ID = "test-admin";
    private static final String ADMIN_PASSWORD = "admin1!";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private TestUserFactory testUserFactory;

    private String managerToken;
    private String residentToken;
    private String adminToken;
    private UUID slot2FAId;

    @BeforeEach
    void setUp() throws Exception {
        jdbcTemplate.update("DELETE FROM notification");
        jdbcTemplate.update("DELETE FROM inspection_schedule");
        ensureResidentWithRole(FLOOR2_ROOM05_SLOT3, DEFAULT_PASSWORD, "FLOOR_MANAGER", "층장");
        ensureResident(FLOOR2_ROOM05_SLOT1, DEFAULT_PASSWORD);
        testUserFactory.ensureAdmin(ADMIN_LOGIN_ID, ADMIN_PASSWORD);
        managerToken = login(FLOOR2_ROOM05_SLOT3, DEFAULT_PASSWORD);
        residentToken = login(FLOOR2_ROOM05_SLOT1, DEFAULT_PASSWORD);
        adminToken = login(ADMIN_LOGIN_ID, ADMIN_PASSWORD);
        slot2FAId = fetchSlotId(FLOOR_2, SLOT_INDEX_A);
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

    private void ensureResident(String loginId, String password) {
        String roomNumber = loginId.split("-")[0];
        short floor = Short.parseShort(roomNumber.substring(0, 1));
        short personalNo = Short.parseShort(loginId.split("-")[1]);
        testUserFactory.ensureResident(loginId, password, floor, roomNumber, personalNo);
    }

    private void ensureResidentWithRole(String loginId, String password, String roleCode, String roleName) {
        var resident = testUserFactory.ensureResident(loginId, password,
                Short.parseShort(loginId.split("-")[0].substring(0, 1)),
                loginId.split("-")[0],
                Short.parseShort(loginId.split("-")[1]));
        testUserFactory.ensureRole(roleCode, roleName);
        testUserFactory.grantRole(resident, roleCode);
    }

    @AfterEach
    void tearDown() {
        jdbcTemplate.update("DELETE FROM notification");
        jdbcTemplate.update("DELETE FROM inspection_schedule");
    }

    @Test
    void managerCanManageSchedules() throws Exception {
        OffsetDateTime scheduledAt = OffsetDateTime.now(ZoneOffset.UTC).plusDays(3).withNano(0);
        String payload = """
                {
                  "scheduledAt": "%s",
                  "title": "11월 정기 점검",
                  "notes": "층별장 회의 이후 진행 예정",
                  "fridgeCompartmentId": "%s"
                }
                """.formatted(scheduledAt, slot2FAId);

        MvcResult createdResult = mockMvc.perform(post("/fridge/inspection-schedules")
                        .header("Authorization", "Bearer " + managerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("SCHEDULED"))
                .andExpect(jsonPath("$.scheduleId").isNotEmpty())
                .andExpect(jsonPath("$.fridgeCompartmentId").value(slot2FAId.toString()))
                .andReturn();

        JsonNode created = objectMapper.readTree(createdResult.getResponse().getContentAsString());
        UUID scheduleId = UUID.fromString(created.path("scheduleId").asText());

        mockMvc.perform(get("/fridge/inspection-schedules")
                        .header("Authorization", "Bearer " + managerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].scheduleId").value(scheduleId.toString()));

        mockMvc.perform(get("/fridge/inspection-schedules/next")
                        .header("Authorization", "Bearer " + residentToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.scheduleId").value(scheduleId.toString()))
                .andExpect(jsonPath("$.status").value("SCHEDULED"));

        mockMvc.perform(patch("/fridge/inspection-schedules/" + scheduleId)
                        .header("Authorization", "Bearer " + managerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "status": "COMPLETED"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("COMPLETED"))
                .andExpect(jsonPath("$.completedAt").isNotEmpty());

        mockMvc.perform(delete("/fridge/inspection-schedules/" + scheduleId)
                        .header("Authorization", "Bearer " + managerToken))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/fridge/inspection-schedules")
                        .header("Authorization", "Bearer " + managerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(0)));
    }

    @Test
    void residentCannotCreateSchedule() throws Exception {
        OffsetDateTime scheduledAt = OffsetDateTime.now(ZoneOffset.UTC).plusDays(1).withNano(0);

        mockMvc.perform(post("/fridge/inspection-schedules")
                        .header("Authorization", "Bearer " + residentToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "scheduledAt": "%s",
                                  "fridgeCompartmentId": "%s"
                                }
                                """.formatted(scheduledAt, slot2FAId)))
                .andExpect(status().isForbidden());
    }

    @Test
    void adminCannotManageSchedules() throws Exception {
        OffsetDateTime scheduledAt = OffsetDateTime.now(ZoneOffset.UTC).plusDays(2).withNano(0);

        mockMvc.perform(post("/fridge/inspection-schedules")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "scheduledAt": "%s",
                                  "title": "관리자 시도",
                                  "fridgeCompartmentId": "%s"
                                }
                                """.formatted(scheduledAt, slot2FAId)))
                .andExpect(status().isForbidden());

        MvcResult createdResult = mockMvc.perform(post("/fridge/inspection-schedules")
                        .header("Authorization", "Bearer " + managerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "scheduledAt": "%s",
                                  "title": "층별장 일정",
                                  "fridgeCompartmentId": "%s"
                                }
                                """.formatted(scheduledAt, slot2FAId)))
                .andExpect(status().isCreated())
                .andReturn();

        JsonNode created = objectMapper.readTree(createdResult.getResponse().getContentAsString());
        UUID scheduleId = UUID.fromString(created.path("scheduleId").asText());

        mockMvc.perform(patch("/fridge/inspection-schedules/" + scheduleId)
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "status": "COMPLETED"
                                }
                                """))
                .andExpect(status().isForbidden());

        mockMvc.perform(delete("/fridge/inspection-schedules/" + scheduleId)
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isForbidden());
    }

    @Test
    void managerCannotCreateDuplicateScheduleForSameSlotAndTime() throws Exception {
        OffsetDateTime scheduledAt = OffsetDateTime.now(ZoneOffset.UTC).plusDays(4).withNano(0);
        String payload = """
                {
                  "scheduledAt": "%s",
                  "title": "중복 예약 테스트",
                  "fridgeCompartmentId": "%s"
                }
                """.formatted(scheduledAt, slot2FAId);

        mockMvc.perform(post("/fridge/inspection-schedules")
                        .header("Authorization", "Bearer " + managerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isCreated());

        mockMvc.perform(post("/fridge/inspection-schedules")
                        .header("Authorization", "Bearer " + managerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("SCHEDULE_CONFLICT"));
    }

    @Test
    void creatingScheduleSendsNotificationsToResidents() throws Exception {
        OffsetDateTime scheduledAt = OffsetDateTime.now(ZoneOffset.UTC).plusDays(5).withNano(0);

        MvcResult result = mockMvc.perform(post("/fridge/inspection-schedules")
                        .header("Authorization", "Bearer " + managerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "scheduledAt": "%s",
                                  "title": "알림 검증",
                                  "fridgeCompartmentId": "%s"
                                }
                                """.formatted(scheduledAt, slot2FAId)))
                .andExpect(status().isCreated())
                .andReturn();

        JsonNode created = objectMapper.readTree(result.getResponse().getContentAsString());
        UUID scheduleId = UUID.fromString(created.path("scheduleId").asText());

        Integer notificationCount = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM notification WHERE kind_code = 'FRIDGE_SCHEDULE'",
                Integer.class
        );
        assertThat(notificationCount).isNotNull();
        assertThat(notificationCount).isGreaterThan(0);

        UUID residentId = fetchUserId(TARGET_RESIDENT_LOGIN);
        Integer residentNotifications = jdbcTemplate.queryForObject(
                """
                        SELECT COUNT(*)
                        FROM notification
                        WHERE user_id = ?
                          AND kind_code = 'FRIDGE_SCHEDULE'
                          AND dedupe_key = ?
                        """,
                Integer.class,
                residentId,
                "FRIDGE_SCHEDULE:" + scheduleId + ":" + residentId
        );
        assertThat(residentNotifications).isNotNull();
        assertThat(residentNotifications).isGreaterThan(0);
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

    private UUID fetchUserId(String loginId) {
        return jdbcTemplate.queryForObject(
                "SELECT id FROM dorm_user WHERE login_id = ?",
                (rs, rowNum) -> UUID.fromString(rs.getString("id")),
                loginId
        );
    }
}

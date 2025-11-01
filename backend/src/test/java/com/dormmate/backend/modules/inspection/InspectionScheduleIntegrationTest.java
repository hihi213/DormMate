package com.dormmate.backend.modules.inspection;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.dormmate.backend.support.AbstractPostgresIntegrationTest;
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

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    private String managerToken;
    private String residentToken;
    private String adminToken;

    @BeforeEach
    void setUp() throws Exception {
        jdbcTemplate.update("DELETE FROM inspection_schedule");
        managerToken = login("bob", "bob123!");
        residentToken = login("alice", "alice123!");
        adminToken = login("admin", "password");
    }

    @AfterEach
    void tearDown() {
        jdbcTemplate.update("DELETE FROM inspection_schedule");
    }

    @Test
    void managerCanManageSchedules() throws Exception {
        OffsetDateTime scheduledAt = OffsetDateTime.now(ZoneOffset.UTC).plusDays(3).withNano(0);
        String payload = """
                {
                  "scheduledAt": "%s",
                  "title": "11월 정기 점검",
                  "notes": "층별장 회의 이후 진행 예정"
                }
                """.formatted(scheduledAt);

        MvcResult createdResult = mockMvc.perform(post("/fridge/inspection-schedules")
                        .header("Authorization", "Bearer " + managerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("SCHEDULED"))
                .andExpect(jsonPath("$.scheduleId").isNotEmpty())
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
                                  "scheduledAt": "%s"
                                }
                                """.formatted(scheduledAt)))
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
                                  "title": "관리자 시도"
                                }
                                """.formatted(scheduledAt)))
                .andExpect(status().isForbidden());

        MvcResult createdResult = mockMvc.perform(post("/fridge/inspection-schedules")
                        .header("Authorization", "Bearer " + managerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "scheduledAt": "%s",
                                  "title": "층별장 일정"
                                }
                                """.formatted(scheduledAt)))
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

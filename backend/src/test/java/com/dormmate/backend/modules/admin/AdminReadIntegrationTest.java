package com.dormmate.backend.modules.admin;

import static com.dormmate.backend.support.TestResidentAccounts.DEFAULT_PASSWORD;
import static com.dormmate.backend.support.TestResidentAccounts.FLOOR2_ROOM05_SLOT1;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.dormmate.backend.support.AbstractPostgresIntegrationTest;
import com.dormmate.backend.support.TestUserFactory;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

@SpringBootTest
@AutoConfigureMockMvc
class AdminReadIntegrationTest extends AbstractPostgresIntegrationTest {

    private static final String ADMIN_LOGIN_ID = "test-admin";
    private static final String ADMIN_PASSWORD = "admin1!";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private TestUserFactory testUserFactory;

    @BeforeEach
    void setUp() {
        testUserFactory.ensureAdmin(ADMIN_LOGIN_ID, ADMIN_PASSWORD);
        ensureResident(FLOOR2_ROOM05_SLOT1, DEFAULT_PASSWORD);
    }

    @Test
    void adminCanReadDashboardUsersAndPolicies() throws Exception {
        String adminToken = loginAndGetAccessToken(ADMIN_LOGIN_ID, ADMIN_PASSWORD);

        mockMvc.perform(get("/admin/dashboard")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.summary").isArray())
                .andExpect(jsonPath("$.quickActions").isArray());

        mockMvc.perform(get("/admin/users")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items").isArray());

        mockMvc.perform(get("/admin/policies")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.notification.batchTime").exists());
    }

    @Test
    void adminCanFilterUsersByFloorSearchAndPagination() throws Exception {
        String adminToken = loginAndGetAccessToken(ADMIN_LOGIN_ID, ADMIN_PASSWORD);

        mockMvc.perform(get("/admin/users")
                        .header("Authorization", "Bearer " + adminToken)
                        .param("status", "ACTIVE")
                        .param("floor", "2")
                        .param("search", "205")
                        .param("page", "0")
                        .param("size", "5"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.page").value(0))
                .andExpect(jsonPath("$.size").value(5))
                .andExpect(jsonPath("$.items").isArray())
                .andExpect(jsonPath("$.availableFloors").isArray());
    }

    @Test
    void nonAdminCannotAccessAdminReadEndpoints() throws Exception {
        String residentToken = loginAndGetAccessToken(FLOOR2_ROOM05_SLOT1, DEFAULT_PASSWORD);

        mockMvc.perform(get("/admin/dashboard")
                        .header("Authorization", "Bearer " + residentToken))
                .andExpect(status().isForbidden());
    }

    private String loginAndGetAccessToken(String loginId, String password) throws Exception {
        String deviceId = loginId + "-device";
        MvcResult result = mockMvc.perform(
                        post("/auth/login")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("""
                                        {
                                          \"loginId\": \"%s\",
                                          \"password\": \"%s\",
                                          \"deviceId\": \"%s\"
                                        }
                                        """.formatted(loginId, password, deviceId))
                )
                .andExpect(status().isOk())
                .andReturn();
        JsonNode response = objectMapper.readTree(result.getResponse().getContentAsString());
        return response.path("tokens").path("accessToken").asText();
    }

    private void ensureResident(String loginId, String password) {
        String roomNumber = loginId.split("-")[0];
        short floor = Short.parseShort(roomNumber.substring(0, 1));
        short personalNo = Short.parseShort(loginId.split("-")[1]);
        testUserFactory.ensureResident(loginId, password, floor, roomNumber, personalNo);
    }
}

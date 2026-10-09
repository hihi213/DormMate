package com.dormmate.backend.modules.admin;

import static com.dormmate.backend.support.TestResidentAccounts.DEFAULT_PASSWORD;
import static com.dormmate.backend.support.TestResidentAccounts.FLOOR2_ROOM05_SLOT1;
import static com.dormmate.backend.support.TestResidentAccounts.FLOOR3_ROOM05_SLOT1;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.UUID;

import com.dormmate.backend.support.AbstractPostgresIntegrationTest;
import com.dormmate.backend.support.TestUserFactory;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

@SpringBootTest
@AutoConfigureMockMvc
class AdminSecurityAccessIntegrationTest extends AbstractPostgresIntegrationTest {

    private static final String ADMIN_LOGIN_ID = "sec-admin";
    private static final String ADMIN_PASSWORD = "adminPass123!";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private TestUserFactory testUserFactory;

    private String adminToken;
    private String residentToken;
    private String floorManagerToken;

    @BeforeEach
    void setUp() throws Exception {
        testUserFactory.ensureAdmin(ADMIN_LOGIN_ID, ADMIN_PASSWORD);
        testUserFactory.ensureResident(FLOOR2_ROOM05_SLOT1, DEFAULT_PASSWORD, (short) 2, "205", (short) 1);
        var fm = testUserFactory.ensureResident(FLOOR3_ROOM05_SLOT1, DEFAULT_PASSWORD, (short) 3, "305", (short) 1);
        testUserFactory.ensureRole("FLOOR_MANAGER", "층별장");
        testUserFactory.grantRole(fm, "FLOOR_MANAGER");

        adminToken = loginAndGetToken(ADMIN_LOGIN_ID, ADMIN_PASSWORD);
        residentToken = loginAndGetToken(FLOOR2_ROOM05_SLOT1, DEFAULT_PASSWORD);
        floorManagerToken = loginAndGetToken(FLOOR3_ROOM05_SLOT1, DEFAULT_PASSWORD);
    }

    @Test
    @DisplayName("비인증 요청은 모든 관리자 엔드포인트에서 401을 반환해야 한다")
    void unauthenticatedAccessReturns401() throws Exception {
        mockMvc.perform(get("/admin/dashboard")).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/admin/users")).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/admin/policies")).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/admin/fridge/issues")).andExpect(status().isUnauthorized());
        mockMvc.perform(post("/admin/users/" + UUID.randomUUID() + "/roles/floor-manager")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"reason\":\"test\"}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("일반 거주자(RESIDENT)는 모든 관리자 엔드포인트에서 403을 반환해야 한다")
    void residentAccessReturns403() throws Exception {
        mockMvc.perform(get("/admin/dashboard")
                .header("Authorization", "Bearer " + residentToken))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/admin/users")
                .header("Authorization", "Bearer " + residentToken))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/admin/policies")
                .header("Authorization", "Bearer " + residentToken))
                .andExpect(status().isForbidden());

        mockMvc.perform(post("/admin/users/" + UUID.randomUUID() + "/roles/floor-manager")
                .header("Authorization", "Bearer " + residentToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"reason\":\"test\"}"))
                .andExpect(status().isForbidden());

        mockMvc.perform(patch("/admin/users/" + UUID.randomUUID() + "/status")
                .header("Authorization", "Bearer " + residentToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"status\":\"INACTIVE\",\"reason\":\"test\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("층별장(FLOOR_MANAGER)도 전역 관리자 엔드포인트 접근 시 403을 반환해야 한다")
    void floorManagerAccessReturns403() throws Exception {
        mockMvc.perform(get("/admin/dashboard")
                .header("Authorization", "Bearer " + floorManagerToken))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/admin/policies")
                .header("Authorization", "Bearer " + floorManagerToken))
                .andExpect(status().isForbidden());

        mockMvc.perform(delete("/admin/users/" + UUID.randomUUID() + "/roles/floor-manager")
                .header("Authorization", "Bearer " + floorManagerToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"reason\":\"test\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("관리자(ADMIN) 권한 토큰으로는 관리자 엔드포인트 조회가 정상 허용된다")
    void adminAccessAllowed() throws Exception {
        mockMvc.perform(get("/admin/dashboard")
                .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk());

        mockMvc.perform(get("/admin/users")
                .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk());

        mockMvc.perform(get("/admin/policies")
                .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk());
    }

    private String loginAndGetToken(String loginId, String password) throws Exception {
        MvcResult result = mockMvc.perform(
                post("/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "loginId": "%s",
                                  "password": "%s",
                                  "deviceId": "%s"
                                }
                                """.formatted(loginId, password, loginId + "-device"))
        ).andExpect(status().isOk()).andReturn();

        JsonNode json = objectMapper.readTree(result.getResponse().getContentAsString());
        return json.path("tokens").path("accessToken").asText();
    }
}

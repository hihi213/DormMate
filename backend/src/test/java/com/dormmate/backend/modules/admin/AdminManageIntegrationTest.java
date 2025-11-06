package com.dormmate.backend.modules.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.UUID;

import com.dormmate.backend.modules.auth.domain.DormUser;
import com.dormmate.backend.modules.auth.domain.DormUserStatus;
import com.dormmate.backend.modules.auth.infrastructure.persistence.DormUserRepository;
import com.dormmate.backend.modules.auth.infrastructure.persistence.UserRoleRepository;
import com.dormmate.backend.support.AbstractPostgresIntegrationTest;
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
class AdminManageIntegrationTest extends AbstractPostgresIntegrationTest {

    private static final String FLOOR_MANAGER_ROLE = "FLOOR_MANAGER";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private DormUserRepository dormUserRepository;

    @Autowired
    private UserRoleRepository userRoleRepository;

    private String adminToken;

    @BeforeEach
    void setUp() throws Exception {
        adminToken = loginAndGetAccessToken("dormate", "admin123!");
    }

    @Test
    void adminCanPromoteAndDemoteFloorManager() throws Exception {
        DormUser target = findUserByLogin("diana");
        UUID targetId = target.getId();

        mockMvc.perform(post("/admin/users/{id}/roles/floor-manager", targetId)
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isNoContent());

        boolean hasRoleAfterPromotion = userRoleRepository.findActiveRoles(targetId).stream()
                .anyMatch(role -> FLOOR_MANAGER_ROLE.equals(role.getRole().getCode()));
        assertThat(hasRoleAfterPromotion).isTrue();

        mockMvc.perform(delete("/admin/users/{id}/roles/floor-manager", targetId)
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isNoContent());

        boolean hasRoleAfterDemotion = userRoleRepository.findActiveRoles(targetId).stream()
                .anyMatch(role -> FLOOR_MANAGER_ROLE.equals(role.getRole().getCode()));
        assertThat(hasRoleAfterDemotion).isFalse();
    }

    @Test
    void adminCanDeactivateUser() throws Exception {
        DormUser target = findUserByLogin("dylan");
        UUID targetId = target.getId();

        try {
            mockMvc.perform(patch("/admin/users/{id}/status", targetId)
                            .header("Authorization", "Bearer " + adminToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                    {"status":"INACTIVE"}
                                    """))
                    .andExpect(status().isNoContent());

            DormUser updated = dormUserRepository.findById(targetId).orElseThrow();
            assertThat(updated.getStatus()).isEqualTo(DormUserStatus.INACTIVE);
        } finally {
            DormUser toRestore = dormUserRepository.findById(targetId).orElseThrow();
            toRestore.setStatus(DormUserStatus.ACTIVE);
            dormUserRepository.save(toRestore);
        }
    }

    @Test
    void adminCanUpdatePolicies() throws Exception {
        String template = "누적 {점수}점으로 3일 이용 제한입니다.";
        mockMvc.perform(put("/admin/policies")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "notification": {
                                    "batchTime": "08:00",
                                    "dailyLimit": 15,
                                    "ttlHours": 12
                                  },
                                  "penalty": {
                                    "limit": 8,
                                    "template": "%s"
                                  }
                                }
                                """.formatted(template)))
                .andExpect(status().isNoContent());

        MvcResult policiesResult = mockMvc.perform(get("/admin/policies")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode response = objectMapper.readTree(policiesResult.getResponse().getContentAsString());
        assertThat(response.path("notification").path("batchTime").asText()).isEqualTo("08:00");
        assertThat(response.path("notification").path("dailyLimit").asInt()).isEqualTo(15);
        assertThat(response.path("notification").path("ttlHours").asInt()).isEqualTo(12);
        assertThat(response.path("penalty").path("limit").asInt()).isEqualTo(8);
        assertThat(response.path("penalty").path("template").asText()).isNotBlank();
    }

    private DormUser findUserByLogin(String loginId) {
        return dormUserRepository.findByLoginIdIgnoreCase(loginId)
                .orElseThrow(() -> new IllegalArgumentException("사용자를 찾을 수 없습니다: " + loginId));
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
}

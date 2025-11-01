package com.dormmate.backend.modules.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.dormmate.backend.support.AbstractPostgresIntegrationTest;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

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
class AdminSeedIntegrationTest extends AbstractPostgresIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    void adminCanTriggerFridgeDemoSeed() throws Exception {
        jdbcTemplate.update(
                "UPDATE fridge_bundle SET memo = ? WHERE bundle_name = ?",
                "MODIFIED",
                "앨리스 기본 식료품"
        );

        String adminToken = loginAndGetAccessToken("admin", "password");

        mockMvc.perform(post("/admin/seed/fridge-demo")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("FRIDGE_DEMO_DATA_REFRESHED"));

        String memo = jdbcTemplate.queryForObject(
                """
                        SELECT memo
                        FROM fridge_bundle
                        WHERE bundle_name = ?
                          AND status = 'ACTIVE'
                        ORDER BY updated_at DESC
                        LIMIT 1
                        """,
                String.class,
                "앨리스 기본 식료품"
        );
        assertThat(memo).isEqualTo("임박/만료 시나리오용 샘플 포장");
    }

    @Test
    void nonAdminCannotTriggerDemoSeed() throws Exception {
        String residentToken = loginAndGetAccessToken("alice", "alice123!");

        mockMvc.perform(post("/admin/seed/fridge-demo")
                        .header("Authorization", "Bearer " + residentToken))
                .andExpect(status().isForbidden());
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

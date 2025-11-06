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
        jdbcTemplate.update("DELETE FROM fridge_item WHERE item_name LIKE '전시 데모:%'");

        String adminToken = loginAndGetAccessToken("dormate", "admin123!");

        mockMvc.perform(post("/admin/seed/fridge-demo")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("FRIDGE_DEMO_DATA_REFRESHED"));

        Integer itemCount = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM fridge_item WHERE item_name LIKE '전시 데모:%'",
                Integer.class
        );
        assertThat(itemCount)
                .withFailMessage("expected 7 demo items but found %s", itemCount)
                .isNotNull()
                .isEqualTo(7);

        Integer aliceItems = jdbcTemplate.queryForObject(
                """
                        SELECT COUNT(*)
                        FROM fridge_item fi
                        JOIN fridge_bundle fb ON fb.id = fi.fridge_bundle_id
                        JOIN dorm_user du ON du.id = fb.owner_user_id
                        WHERE du.login_id = 'alice'
                          AND fi.item_name LIKE '전시 데모:%'
                        """,
                Integer.class
        );
        assertThat(aliceItems).isNotNull().isGreaterThanOrEqualTo(1);

        mockMvc.perform(post("/admin/seed/fridge-demo")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("FRIDGE_DEMO_DATA_REFRESHED"));

        Integer itemCountAfterSecondCall = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM fridge_item WHERE item_name LIKE '전시 데모:%'",
                Integer.class
        );
        assertThat(itemCountAfterSecondCall)
                .withFailMessage("expected 7 demo items after second call but found %s", itemCountAfterSecondCall)
                .isNotNull()
                .isEqualTo(7);
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

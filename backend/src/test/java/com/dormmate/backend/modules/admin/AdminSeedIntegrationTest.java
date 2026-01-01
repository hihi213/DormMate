package com.dormmate.backend.modules.admin;

import static com.dormmate.backend.support.TestResidentAccounts.DEFAULT_PASSWORD;
import static com.dormmate.backend.support.TestResidentAccounts.FLOOR2_ROOM05_SLOT1;
import static org.assertj.core.api.Assertions.assertThat;
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
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

@SpringBootTest
@AutoConfigureMockMvc
class AdminSeedIntegrationTest extends AbstractPostgresIntegrationTest {

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

    @BeforeEach
    void setUp() {
        testUserFactory.ensureAdmin(ADMIN_LOGIN_ID, ADMIN_PASSWORD);
        ensureResident(FLOOR2_ROOM05_SLOT1, DEFAULT_PASSWORD);
    }

    @Test
    void adminCanTriggerFridgeDemoSeed() throws Exception {
        jdbcTemplate.update("DELETE FROM penalty_history");
        jdbcTemplate.update("DELETE FROM inspection_action_item");
        jdbcTemplate.update("DELETE FROM inspection_action");
        jdbcTemplate.update("DELETE FROM fridge_item");
        jdbcTemplate.update("DELETE FROM fridge_bundle");
        jdbcTemplate.update("DELETE FROM bundle_label_sequence");

        String adminToken = loginAndGetAccessToken(ADMIN_LOGIN_ID, ADMIN_PASSWORD);

        mockMvc.perform(post("/admin/seed/fridge-demo")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("FRIDGE_DEMO_DATA_REFRESHED"));

        Integer bundleCount = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM fridge_bundle",
                Integer.class
        );
        Integer itemCount = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM fridge_item",
                Integer.class
        );
        Integer labelReady = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM bundle_label_sequence WHERE next_number = 11",
                Integer.class
        );

        assertThat(bundleCount)
                .withFailMessage("expected bundles to be seeded but found %s", bundleCount)
                .isNotNull()
                .isGreaterThan(0);
        assertThat(itemCount)
                .withFailMessage("expected items to be seeded but found %s", itemCount)
                .isNotNull()
                .isGreaterThan(0);
        assertThat(labelReady)
                .withFailMessage("expected label sequences to be seeded but found %s", labelReady)
                .isNotNull()
                .isGreaterThan(0);

        mockMvc.perform(post("/admin/seed/fridge-demo")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("FRIDGE_DEMO_DATA_REFRESHED"));

        Integer bundleCountAfterSecondCall = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM fridge_bundle",
                Integer.class
        );
        Integer itemCountAfterSecondCall = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM fridge_item",
                Integer.class
        );
        Integer labelReadyAfterSecondCall = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM bundle_label_sequence WHERE next_number = 11",
                Integer.class
        );
        assertThat(bundleCountAfterSecondCall)
                .withFailMessage("expected bundle count to remain %s but found %s", bundleCount, bundleCountAfterSecondCall)
                .isNotNull()
                .isEqualTo(bundleCount);
        assertThat(itemCountAfterSecondCall)
                .withFailMessage("expected item count to remain %s but found %s", itemCount, itemCountAfterSecondCall)
                .isNotNull()
                .isEqualTo(itemCount);
        assertThat(labelReadyAfterSecondCall)
                .withFailMessage("expected label count to remain %s but found %s", labelReady, labelReadyAfterSecondCall)
                .isNotNull()
                .isEqualTo(labelReady);
    }

    @Test
    void nonAdminCannotTriggerDemoSeed() throws Exception {
        String residentToken = loginAndGetAccessToken(FLOOR2_ROOM05_SLOT1, DEFAULT_PASSWORD);

        mockMvc.perform(post("/admin/seed/fridge-demo")
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
                                          "loginId": "%s",
                                          "password": "%s",
                                          "deviceId": "%s"
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

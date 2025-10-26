package com.dormmate.backend.modules.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.dormmate.backend.modules.auth.infrastructure.persistence.DormUserRepository;
import com.dormmate.backend.support.AbstractPostgresIntegrationTest;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

@SpringBootTest
@org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
class AuthIntegrationTest extends AbstractPostgresIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private DormUserRepository dormUserRepository;

    @Test
    void loginWithSeedAdminReturnsTokenAndProfile() throws Exception {
        assertThat(dormUserRepository.count()).isGreaterThan(0);

        MvcResult result = mockMvc.perform(
                        post("/auth/login")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("""
                                        {
                                          "loginId": "admin",
                                          "password": "password"
                                        }
                                        """)
                )
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.tokens.accessToken").isNotEmpty())
                .andExpect(jsonPath("$.tokens.refreshToken").isNotEmpty())
                .andExpect(jsonPath("$.user.loginId").value("admin"))
                .andReturn();

        JsonNode response = objectMapper.readTree(result.getResponse().getContentAsString());
        assertThat(response.path("user").path("roles"))
                .as("seed admin roles should include ADMIN")
                .anyMatch(node -> node.asText().equals("ADMIN"));
    }

    @Test
    void canFetchProfileWithIssuedAccessToken() throws Exception {
        String accessToken = obtainAccessToken();

        mockMvc.perform(
                        get("/profile/me")
                                .header("Authorization", "Bearer " + accessToken)
                )
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.loginId").value("admin"))
                .andExpect(jsonPath("$.isAdmin").value(true));
    }

    private String obtainAccessToken() throws Exception {
        MvcResult result = mockMvc.perform(
                        post("/auth/login")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("""
                                        {
                                          "loginId": "admin",
                                          "password": "password"
                                        }
                                        """)
                )
                .andExpect(status().isOk())
                .andReturn();

        JsonNode response = objectMapper.readTree(result.getResponse().getContentAsString());
        return response.path("tokens").path("accessToken").asText();
    }
}

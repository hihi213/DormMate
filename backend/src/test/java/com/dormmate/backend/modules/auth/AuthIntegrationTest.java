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

        JsonNode response = loginAsAdmin();

        assertThat(response.path("user").path("roles"))
                .as("seed admin roles should include ADMIN")
                .anyMatch(node -> node.asText().equals("ADMIN"));
    }

    @Test
    void canFetchProfileWithIssuedAccessToken() throws Exception {
        String accessToken = loginAsAdmin()
                .path("tokens")
                .path("accessToken")
                .asText();

        mockMvc.perform(
                        get("/profile/me")
                                .header("Authorization", "Bearer " + accessToken)
                )
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.loginId").value("dormmate"))
                .andExpect(jsonPath("$.isAdmin").value(true));
    }

    @Test
    void refreshRotatesRefreshTokenAndRevokesOldSession() throws Exception {
        JsonNode initialLogin = loginAsAdmin();
        String originalRefreshToken = initialLogin.path("tokens").path("refreshToken").asText();

        MvcResult refreshResult = mockMvc.perform(
                        post("/auth/refresh")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("""
                                        {
                                          "refreshToken": "%s"
                                        }
                                        """.formatted(originalRefreshToken))
                )
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.tokens.refreshToken").isNotEmpty())
                .andReturn();

        JsonNode refreshed = objectMapper.readTree(refreshResult.getResponse().getContentAsString());
        String rotatedRefreshToken = refreshed.path("tokens").path("refreshToken").asText();

        assertThat(rotatedRefreshToken)
                .as("refresh token must rotate on /auth/refresh")
                .isNotEqualTo(originalRefreshToken);

        mockMvc.perform(
                        post("/auth/refresh")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("""
                                        {
                                          "refreshToken": "%s"
                                        }
                                        """.formatted(originalRefreshToken))
                )
                .andExpect(status().isUnauthorized());
    }

    @Test
    void logoutRevokesSessionAndPreventsFurtherRefresh() throws Exception {
        JsonNode loginResponse = loginAsAdmin();
        String refreshToken = loginResponse.path("tokens").path("refreshToken").asText();

        mockMvc.perform(
                        post("/auth/logout")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("""
                                        {
                                          "refreshToken": "%s"
                                        }
                                        """.formatted(refreshToken))
                )
                .andExpect(status().isNoContent());

        mockMvc.perform(
                        post("/auth/refresh")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("""
                                        {
                                          "refreshToken": "%s"
                                        }
                                        """.formatted(refreshToken))
                )
                .andExpect(status().isUnauthorized());
    }

    private JsonNode loginAsAdmin() throws Exception {
        MvcResult result = mockMvc.perform(
                        post("/auth/login")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("""
                                        {
                                          "loginId": "dormmate",
                                          "password": "admin1!"
                                        }
                                        """)
                )
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.tokens.accessToken").isNotEmpty())
                .andExpect(jsonPath("$.tokens.refreshToken").isNotEmpty())
                .andExpect(jsonPath("$.user.loginId").value("dormmate"))
                .andReturn();

        return objectMapper.readTree(result.getResponse().getContentAsString());
    }
}

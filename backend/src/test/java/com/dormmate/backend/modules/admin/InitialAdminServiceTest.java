package com.dormmate.backend.modules.admin;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import com.dormmate.backend.modules.admin.application.InitialAdminService;
import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.*;
import org.springframework.aop.support.AopUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.PostgreSQLContainer;
import static org.assertj.core.api.Assertions.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = {"dormmate.bootstrap.enabled=true", "dormmate.bootstrap.login-id=initial-admin",
                "dormmate.bootstrap.name=Initial Admin", "dormmate.bootstrap.email=admin@example.test"})
@ActiveProfiles("prod")
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class InitialAdminServiceTest {
    private static final String PASSWORD = "TestOnlySecurePass123!";
    private static final PostgreSQLContainer<?> DB = new PostgreSQLContainer<>("postgres:16.4");
    private static final GenericContainer<?> REDIS = new GenericContainer<>("redis:7.2-alpine").withExposedPorts(6379);
    private static Path passwordFile;
    static {
        DB.start(); REDIS.start();
        try {
            passwordFile = Files.createTempFile("dormmate-bootstrap-test-", ".txt");
            Files.writeString(passwordFile, PASSWORD);
        } catch (Exception e) { throw new ExceptionInInitializerError(e); }
    }
    @DynamicPropertySource
    static void properties(DynamicPropertyRegistry registry) {
        registry.add("jwt.secret", () -> "test-only-bootstrap-jwt-secret-at-least-32-bytes!");
        registry.add("spring.datasource.url", DB::getJdbcUrl);
        registry.add("spring.datasource.username", DB::getUsername);
        registry.add("spring.datasource.password", DB::getPassword);
        registry.add("spring.flyway.locations", () -> "classpath:db/production");
        registry.add("spring.data.redis.host", REDIS::getHost);
        registry.add("spring.data.redis.port", () -> REDIS.getMappedPort(6379));
        registry.add("dormmate.bootstrap.password-file", () -> passwordFile.toString());
    }
    @Autowired InitialAdminService service;
    @Autowired JdbcTemplate jdbc;
    @Autowired PasswordEncoder encoder;
    @Autowired TestRestTemplate http;

    @AfterEach
    void clearDisposableDatabase() {
        jdbc.execute("TRUNCATE dorm_user, audit_log, admin_bootstrap_state CASCADE");
    }
    @AfterAll static void cleanup() throws Exception {
        Files.deleteIfExists(passwordFile);
        REDIS.stop(); DB.stop();
    }

    @Test @Order(1)
    void productionStartupCreatesAdminWhoCanLoginAndCallProtectedApi() {
        assertThat(AopUtils.isAopProxy(service)).isTrue();
        assertThat(http.getForObject("/readyz", JsonNode.class).path("status").asText()).isEqualTo("UP");
        var login = http.postForEntity("/auth/login", Map.of("loginId", "initial-admin",
                "password", PASSWORD, "deviceId", "bootstrap-test"), JsonNode.class);
        assertThat(login.getStatusCode()).as("Login response: %s", login.getBody()).isEqualTo(HttpStatus.OK);
        String token = login.getBody().path("tokens").path("accessToken").asText();
        assertThat(token).isNotBlank();
        var headers = new HttpHeaders(); headers.setBearerAuth(token);
        assertThat(http.exchange("/admin/users", HttpMethod.GET, new HttpEntity<>(headers), String.class)
                .getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(http.getForEntity("/admin/users", String.class).getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        String hash = jdbc.queryForObject("SELECT password_hash FROM dorm_user WHERE login_id='initial-admin'", String.class);
        assertThat(encoder.matches(PASSWORD, hash)).isTrue();
        assertThat(service.createOnce("other-admin", "DifferentPass123!", "Other", "other@example.test")).isFalse();
        assertThat(jdbc.queryForObject("SELECT password_hash FROM dorm_user WHERE login_id='initial-admin'", String.class)).isEqualTo(hash);
    }

    @Test @Order(2)
    void concurrentCallsCreateOnlyOneAdmin() throws Exception {
        var gate = new CountDownLatch(1);
        try (var pool = Executors.newFixedThreadPool(2)) {
            var first = pool.submit(() -> { gate.await(); return create("first-admin"); });
            var second = pool.submit(() -> { gate.await(); return create("second-admin"); });
            gate.countDown();
            assertThat(first.get(15, TimeUnit.SECONDS) ^ second.get(15, TimeUnit.SECONDS)).isTrue();
        }
        for (String table : new String[]{"dorm_user", "user_role", "audit_log", "admin_bootstrap_state"}) {
            assertThat(jdbc.queryForObject("SELECT count(*) FROM " + table, Integer.class)).as(table).isEqualTo(1);
        }
    }

    @Test @Order(3)
    void auditFailureRollsBackAccountRoleAndCompletionMarker() {
        jdbc.execute("ALTER TABLE audit_log ADD CONSTRAINT reject_bootstrap_test CHECK (action_type <> 'INITIAL_ADMIN_CREATED')");
        try {
            assertThatThrownBy(() -> create("rollback-admin")).isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
            for (String table : new String[]{"dorm_user", "user_role", "audit_log", "admin_bootstrap_state"}) {
                assertThat(jdbc.queryForObject("SELECT count(*) FROM " + table, Integer.class)).as(table).isZero();
            }
        } finally {
            jdbc.execute("ALTER TABLE audit_log DROP CONSTRAINT reject_bootstrap_test");
        }
        assertThat(create("retry-admin")).isTrue();
    }

    @Test @Order(4)
    void invalidInputAndExistingResidentAreNotPromoted() {
        assertThatThrownBy(() -> service.createOnce("admin", "short", "Admin", "a@example.test"))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.createOnce("admin", PASSWORD, "Admin", "invalid-email"))
                .isInstanceOf(IllegalArgumentException.class);
        jdbc.update("INSERT INTO dorm_user(id,login_id,password_hash,full_name,email,status) VALUES(gen_random_uuid(),'Resident','preserve','Resident','r@example.test','ACTIVE')");
        assertThatThrownBy(() -> create("resident")).isInstanceOf(IllegalStateException.class);
        assertThat(jdbc.queryForObject("SELECT password_hash FROM dorm_user", String.class)).isEqualTo("preserve");
        assertThat(jdbc.queryForObject("SELECT count(*) FROM admin_bootstrap_state", Integer.class)).isZero();
    }
    private boolean create(String login) { return service.createOnce(login, PASSWORD, "Admin", "admin@example.test"); }
}

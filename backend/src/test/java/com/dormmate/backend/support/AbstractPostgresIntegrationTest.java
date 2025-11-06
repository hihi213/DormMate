package com.dormmate.backend.support;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.util.Map;

import org.flywaydb.core.Flyway;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.datasource.init.ScriptException;
import org.springframework.jdbc.datasource.init.ScriptUtils;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;

/**
 * Shared PostgreSQL container configuration for DB-backed integration tests.
 * Orchestrates Flyway migrations so every test class gets the same seeded schema.
 */
public abstract class AbstractPostgresIntegrationTest {

    private static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16.4")
            .withDatabaseName("dormmate_test")
            .withUsername("dormmate_user")
            .withPassword("pleasesetup");

    private static final Object MIGRATION_LOCK = new Object();
    private static boolean initialized = false;

    static {
        POSTGRES.start();
    }

    @DynamicPropertySource
    static void configureDatasource(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);

        registry.add("spring.flyway.url", POSTGRES::getJdbcUrl);
        registry.add("spring.flyway.user", POSTGRES::getUsername);
        registry.add("spring.flyway.password", POSTGRES::getPassword);
        registry.add("spring.flyway.placeholders.admin_login", () -> "admin");
        registry.add("spring.flyway.placeholders.admin_password", () -> "password");

        registry.add("jwt.secret", () -> "dGhpcy1pcy1hLWRldnMtcGxhY2Vob2xkZXItc2VjcmV0LQ==");
        registry.add("jwt.expiration", () -> "86400000");
        registry.add("jwt.refresh-expiration", () -> "604800000");

        synchronized (MIGRATION_LOCK) {
            if (!initialized) {
                cleanAndMigrate();
                initialized = true;
            }
        }
    }

    private static void cleanAndMigrate() {
        Flyway baseConfig = Flyway.configure()
                .dataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword())
                .locations("classpath:db/migration")
                .baselineOnMigrate(true)
                .placeholders(flywayPlaceholders())
                .cleanDisabled(false)
                .load();
        baseConfig.clean();

        Flyway schemaOnly = Flyway.configure()
                .dataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword())
                .locations("classpath:db/migration")
                .baselineOnMigrate(true)
                .placeholders(flywayPlaceholders())
                .target("1")
                .load();
        schemaOnly.migrate();

        applyRepeatableSeed();

        Flyway remainder = Flyway.configure()
                .dataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword())
                .locations("classpath:db/migration")
                .baselineOnMigrate(true)
                .placeholders(flywayPlaceholders())
                .load();
        remainder.migrate();
    }

    private static void applyRepeatableSeed() {
        try (Connection connection = DriverManager.getConnection(
                POSTGRES.getJdbcUrl(),
                POSTGRES.getUsername(),
                POSTGRES.getPassword())) {
            ScriptUtils.executeSqlScript(connection, new ClassPathResource("db/migration/R__Seed.sql"));
        } catch (SQLException | ScriptException ex) {
            throw new IllegalStateException("Failed to apply repeatable seed migration", ex);
        }
    }

    private static Map<String, String> flywayPlaceholders() {
        String adminLogin = sanitizePlaceholder(System.getenv("ADMIN_USERNAME"), "admin", false);
        String adminPassword = sanitizePlaceholder(System.getenv("ADMIN_PASSWORD"), "password", true);
        return Map.of(
                "admin_login", quote(adminLogin),
                "admin_password", quote(adminPassword)
        );
    }

    private static String sanitizePlaceholder(String value, String fallback, boolean enforceMinLength) {
        String candidate = value != null && !value.isBlank() ? value.trim() : fallback;
        if (enforceMinLength && candidate.length() < 8) {
            return fallback;
        }
        return candidate;
    }

    private static String quote(String value) {
        return "'" + value.replace("'", "''") + "'";
    }
}

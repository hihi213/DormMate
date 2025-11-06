package com.dormmate.backend.support;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;

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
            .withUsername("dorm_user")
            .withPassword("dorm_password");

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
                .cleanDisabled(false)
                .load();
        baseConfig.clean();

        Flyway schemaOnly = Flyway.configure()
                .dataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword())
                .locations("classpath:db/migration")
                .baselineOnMigrate(true)
                .target("1")
                .repeatableSqlMigrationPrefix("IGNORE__")
                .load();
        schemaOnly.migrate();

        applyRepeatableSeed();

        Flyway remainder = Flyway.configure()
                .dataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword())
                .locations("classpath:db/migration")
                .baselineOnMigrate(true)
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
}

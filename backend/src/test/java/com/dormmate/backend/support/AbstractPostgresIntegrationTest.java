package com.dormmate.backend.support;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.sql.Statement;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.AfterEach;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.datasource.init.ScriptException;
import org.springframework.jdbc.datasource.init.ScriptUtils;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.DockerClientFactory;
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
        // Prefer system properties (from Gradle -D) over environment variables
        // System properties are set by build.gradle from cli.py's -D options
        String dockerHost = System.getProperty("docker.host");
        if (dockerHost == null || dockerHost.isBlank()) {
            dockerHost = System.getenv("DOCKER_HOST");
        }
        if (dockerHost != null && !dockerHost.isBlank()) {
            System.setProperty("docker.host", dockerHost);
        }
        
        String socketOverride = System.getProperty("testcontainers.docker.socket.override");
        if (socketOverride == null || socketOverride.isBlank()) {
            socketOverride = System.getenv("TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE");
        }
        if (socketOverride != null && !socketOverride.isBlank()) {
            System.setProperty("testcontainers.docker.socket.override", socketOverride);
        }
        
        String apiVersion = System.getProperty("docker.api.version");
        if (apiVersion == null || apiVersion.isBlank()) {
            apiVersion = System.getenv("DOCKER_API_VERSION");
        }
        if (apiVersion == null || apiVersion.isBlank()) {
            apiVersion = "1.44";
        }
        System.setProperty("docker.api.version", apiVersion);
        // Force docker-java to use the specified API version
        System.setProperty("docker.client.apiVersion", apiVersion);
        System.setProperty("com.github.dockerjava.api.version", apiVersion);
        System.setProperty("DOCKER_API_VERSION", apiVersion);
        System.setProperty("api.version", apiVersion);
        
        System.setProperty(
                "testcontainers.docker.client.strategy",
                "org.testcontainers.dockerclient.EnvironmentAndSystemPropertyClientProviderStrategy"
        );
        logDockerDiagnostics();
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
                .repeatableSqlMigrationPrefix("ZZ_SKIP__")
                .load();
        schemaOnly.migrate();

        applyRepeatableSeed();

        Flyway remainder = Flyway.configure()
                .dataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword())
                .locations("classpath:db/migration")
                .baselineOnMigrate(true)
                .load();
        remainder.migrate();

        ensureCompartmentAccessCoverage();
    }

    private static void logDockerDiagnostics() {
        try {
            System.out.println("[testcontainers] DOCKER_HOST=" + System.getenv("DOCKER_HOST"));
            System.out.println("[testcontainers] DOCKER_API_VERSION=" + System.getenv("DOCKER_API_VERSION"));
            System.out.println("[testcontainers] docker.api.version=" + System.getProperty("docker.api.version"));
            System.out.println("[testcontainers] TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE="
                    + System.getenv("TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE"));
            System.out.println("[testcontainers] testcontainers.docker.socket.override="
                    + System.getProperty("testcontainers.docker.socket.override"));
            DockerClientFactory factory = DockerClientFactory.instance();
            System.out.println("[testcontainers] dockerHost=" + factory.getTransportConfig().getDockerHost());
        } catch (Exception ex) {
            System.out.println("[testcontainers] diagnostics failed: " + ex.getMessage());
        }
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

    private static void ensureCompartmentAccessCoverage() {
        try (Connection connection = DriverManager.getConnection(
                POSTGRES.getJdbcUrl(),
                POSTGRES.getUsername(),
                POSTGRES.getPassword());
             Statement stmt = connection.createStatement()) {
            stmt.executeUpdate("""
                    WITH all_compartments AS (
                        SELECT fc.id, fu.floor_no, fc.slot_index
                        FROM fridge_compartment fc
                        JOIN fridge_unit fu ON fu.id = fc.fridge_unit_id
                        WHERE fu.floor_no BETWEEN 2 AND 5
                    ),
                    floor_rooms AS (
                        SELECT r.id AS room_id, r.floor AS floor_no, r.room_number::INTEGER AS room_no
                        FROM room r
                        WHERE r.floor BETWEEN 2 AND 5
                    ),
                    target_access AS (
                        SELECT
                            ac.id AS compartment_id,
                            fr.room_id AS room_id
                        FROM all_compartments ac
                        JOIN floor_rooms fr ON fr.floor_no = ac.floor_no
                        WHERE (ac.slot_index = 0 AND fr.room_no BETWEEN 1 AND 8)
                           OR (ac.slot_index = 1 AND fr.room_no BETWEEN 9 AND 16)
                           OR (ac.slot_index = 2 AND fr.room_no BETWEEN 17 AND 24)
                           OR (ac.slot_index = 3)
                    )
                    INSERT INTO compartment_room_access (
                        id,
                        fridge_compartment_id,
                        room_id,
                        assigned_at,
                        released_at,
                        created_at,
                        updated_at
                    )
                    SELECT
                        gen_random_uuid(),
                        ta.compartment_id,
                        ta.room_id,
                        CURRENT_TIMESTAMP,
                        NULL,
                        CURRENT_TIMESTAMP,
                        CURRENT_TIMESTAMP
                    FROM target_access ta
                    LEFT JOIN compartment_room_access cra
                        ON cra.fridge_compartment_id = ta.compartment_id
                       AND cra.room_id = ta.room_id
                       AND cra.released_at IS NULL
                    WHERE cra.id IS NULL
                    """);
        } catch (SQLException ex) {
            throw new IllegalStateException("Failed to ensure compartment access coverage", ex);
        }
    }

    @AfterEach
    void resetDemoSeed() {
        try (Connection connection = DriverManager.getConnection(
                POSTGRES.getJdbcUrl(),
                POSTGRES.getUsername(),
                POSTGRES.getPassword());
             Statement stmt = connection.createStatement()) {
            stmt.execute("SELECT public.fn_demo_reset_fridge()");
        } catch (SQLException ex) {
            throw new IllegalStateException("Failed to reset demo seed after test", ex);
        }
    }
}

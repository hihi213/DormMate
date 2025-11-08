package com.dormmate.backend.support;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.sql.Statement;

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
                .load();
        schemaOnly.migrate();

        applyRepeatableSeed();

        Flyway remainder = Flyway.configure()
                .dataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword())
                .locations("classpath:db/migration")
                .baselineOnMigrate(true)
                .load();
        remainder.migrate();

        resetFridgeStateForTests();
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

    private static void resetFridgeStateForTests() {
        try (Connection connection = DriverManager.getConnection(
                POSTGRES.getJdbcUrl(),
                POSTGRES.getUsername(),
                POSTGRES.getPassword())) {
            connection.setAutoCommit(false);
            try (Statement stmt = connection.createStatement()) {
                stmt.executeUpdate("DELETE FROM inspection_action_item");
                stmt.executeUpdate("DELETE FROM inspection_action");
                stmt.executeUpdate("DELETE FROM inspection_session");
                stmt.executeUpdate("DELETE FROM inspection_schedule");
                stmt.executeUpdate("DELETE FROM fridge_item");
                stmt.executeUpdate("DELETE FROM fridge_bundle");
                stmt.executeUpdate("DELETE FROM bundle_label_sequence");
                stmt.executeUpdate("UPDATE fridge_compartment SET status = 'ACTIVE', is_locked = FALSE, locked_until = NULL");

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
                                ac.id  AS compartment_id,
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

                stmt.executeUpdate("""
                        INSERT INTO bundle_label_sequence (
                            fridge_compartment_id,
                            next_number,
                            recycled_numbers,
                            created_at,
                            updated_at
                        )
                        SELECT
                            fc.id,
                            1,
                            '[]'::jsonb,
                            CURRENT_TIMESTAMP,
                            CURRENT_TIMESTAMP
                        FROM fridge_compartment fc
                        ON CONFLICT (fridge_compartment_id) DO UPDATE
                        SET next_number = 1,
                            recycled_numbers = '[]'::jsonb,
                            updated_at = CURRENT_TIMESTAMP
                        """);

                connection.commit();
            } catch (SQLException ex) {
                connection.rollback();
                throw ex;
            }
        } catch (SQLException ex) {
            throw new IllegalStateException("Failed to reset fridge fixtures for tests", ex);
        }
    }
}

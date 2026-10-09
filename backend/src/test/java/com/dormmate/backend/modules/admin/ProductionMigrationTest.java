package com.dormmate.backend.modules.admin;

import java.sql.DriverManager;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.testcontainers.containers.PostgreSQLContainer;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ProductionMigrationTest {
    @Test
    void emptyDatabaseInitializesWithoutAccountsAndPreservesNewDataOnRerun() throws Exception {
        try (var postgres = new PostgreSQLContainer<>("postgres:16.4")) {
            postgres.start();
            var flyway = Flyway.configure().dataSource(postgres.getJdbcUrl(),
                    postgres.getUsername(), postgres.getPassword())
                    .locations("classpath:db/production").baselineOnMigrate(false).load();
            flyway.migrate();
            try (var connection = DriverManager.getConnection(postgres.getJdbcUrl(),
                    postgres.getUsername(), postgres.getPassword()); var stmt = connection.createStatement()) {
                for (String table : new String[]{"user_role", "room_assignment",
                        "fridge_bundle", "fridge_item", "penalty_history", "inspection_session"}) {
                    try (var rows = stmt.executeQuery("SELECT count(*) FROM " + table)) {
                        rows.next(); assertThat(rows.getInt(1)).as(table).isZero();
                    }
                }
                try (var rows = stmt.executeQuery("SELECT count(*) FROM room")) {
                    rows.next(); assertThat(rows.getInt(1)).isEqualTo(96);
                }
                try (var rows = stmt.executeQuery("SELECT count(*) FROM dorm_user WHERE status <> 'INACTIVE' OR NOT must_change_password")) {
                    rows.next(); assertThat(rows.getInt(1)).isZero();
                }
                try (var rows = stmt.executeQuery("SELECT count(*) FROM resident_account_slot")) {
                    rows.next(); assertThat(rows.getInt(1)).isEqualTo(278);
                }
                stmt.execute("""
                    INSERT INTO dorm_user(id, login_id, password_hash, full_name, email, status)
                    VALUES(gen_random_uuid(), 'preserved', 'sentinel-hash', 'Real user', 'test@example.invalid', 'ACTIVE')
                    """);
                flyway.validate();
                var wrongHistory = Flyway.configure().dataSource(postgres.getJdbcUrl(),
                        postgres.getUsername(), postgres.getPassword())
                        .locations("classpath:db/migration").baselineOnMigrate(false).load();
                assertThatThrownBy(wrongHistory::migrate).hasMessageContaining("Validate failed");
                assertThat(flyway.migrate().migrationsExecuted).isZero();
                try (var rows = stmt.executeQuery("SELECT password_hash FROM dorm_user WHERE login_id='preserved'")) {
                    assertThat(rows.next()).isTrue(); assertThat(rows.getString(1)).isEqualTo("sentinel-hash");
                }
            }
        }
    }

    @Test
    void untrackedExistingDatabaseIsRejectedRatherThanBaselined() throws Exception {
        try (var postgres = new PostgreSQLContainer<>("postgres:16.4")) {
            postgres.start();
            try (var connection = DriverManager.getConnection(postgres.getJdbcUrl(),
                    postgres.getUsername(), postgres.getPassword()); var stmt = connection.createStatement()) {
                stmt.execute("CREATE TABLE existing_data(id int)");
            }
            var flyway = Flyway.configure().dataSource(postgres.getJdbcUrl(),
                    postgres.getUsername(), postgres.getPassword())
                    .locations("classpath:db/production").baselineOnMigrate(false).load();
            assertThatThrownBy(flyway::migrate).hasMessageContaining("non-empty schema");
        }
    }
}

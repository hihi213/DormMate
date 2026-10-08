package com.dormmate.backend.modules.admin;

import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.DriverManager;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.core.io.ClassPathResource;
import org.testcontainers.containers.PostgreSQLContainer;
import static org.assertj.core.api.Assertions.assertThat;

class DemoResetMigrationTest {
    @TempDir Path migrations;

    @Test
    void previouslyAppliedRepeatableCanUpgradeWithoutDeletingData() throws Exception {
        try (var postgres = new PostgreSQLContainer<>("postgres:16.4")) {
            postgres.start();
            Files.writeString(migrations.resolve("V1__schema.sql"),
                    "CREATE TABLE retained_records (id int primary key);");
            Path repeatable = migrations.resolve("R__demo_reset.sql");
            // Model an already-applied destructive repeatable with the same identity.
            Files.writeString(repeatable, """
                    CREATE FUNCTION public.fn_demo_reset_fridge() RETURNS void
                    LANGUAGE SQL AS 'DELETE FROM retained_records';
                    SELECT public.fn_demo_reset_fridge();
                    """);
            var flyway = Flyway.configure().dataSource(postgres.getJdbcUrl(),
                    postgres.getUsername(), postgres.getPassword())
                    .locations("filesystem:" + migrations).load();
            flyway.migrate();
            try (var connection = DriverManager.getConnection(postgres.getJdbcUrl(),
                    postgres.getUsername(), postgres.getPassword());
                 var statement = connection.createStatement()) {
                statement.execute("INSERT INTO retained_records VALUES (1)");
                try (var input = new ClassPathResource("db/migration/R__demo_reset.sql").getInputStream()) {
                    Files.write(repeatable, input.readAllBytes());
                }
                flyway.migrate();
                flyway.validate();
                assertThat(flyway.migrate().migrationsExecuted).isZero();
                try (var rows = statement.executeQuery("SELECT count(*) FROM retained_records")) {
                    rows.next();
                    assertThat(rows.getInt(1)).isEqualTo(1);
                }
                try (var rows = statement.executeQuery(
                        "SELECT to_regprocedure('public.fn_demo_reset_fridge()') IS NULL")) {
                    rows.next();
                    assertThat(rows.getBoolean(1)).isTrue();
                }
            }
        }
    }

    @Test
    void freshDatabaseDoesNotInstallDemoResetFunction() throws Exception {
        try (var postgres = new PostgreSQLContainer<>("postgres:16.4")) {
            postgres.start();
            try (var input = new ClassPathResource("db/migration/R__demo_reset.sql").getInputStream()) {
                Files.write(migrations.resolve("R__demo_reset.sql"), input.readAllBytes());
            }
            var flyway = Flyway.configure().dataSource(postgres.getJdbcUrl(),
                    postgres.getUsername(), postgres.getPassword())
                    .locations("filesystem:" + migrations).load();
            flyway.migrate();
            flyway.validate();
            assertThat(flyway.migrate().migrationsExecuted).isZero();
        }
    }
}

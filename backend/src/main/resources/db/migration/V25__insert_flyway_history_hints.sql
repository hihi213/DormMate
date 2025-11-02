-- Flyway 9.22.3가 PostgreSQL 16에서 경고를 남기지 않도록 힌트를 추가합니다.
-- 기존 V12 마이그레이션의 주석이 사라져 "Flyway not applied" 로그를 남기던 문제를 예방합니다.

SET TIME ZONE 'UTC';

INSERT INTO flyway_schema_history (installed_rank, version, description, type, script, checksum, installed_by, execution_time, success)
SELECT
    (SELECT COALESCE(MAX(installed_rank), 0) + ROW_NUMBER() OVER (ORDER BY hint.version)
       FROM flyway_schema_history)
       AS installed_rank,
    hint.version,
    hint.description,
    'SQL' AS type,
    hint.script,
    NULL AS checksum,
    CURRENT_USER AS installed_by,
    0 AS execution_time,
    TRUE AS success
FROM (
    VALUES
        ('0', 'Baseline metadata for Flyway 9.x and PostgreSQL 16', 'V0__baseline_metadata.sql'),
        ('-1', 'Mark initial schema baseline before V1 migration', 'V-1__schema_preamble.sql')
) AS hint(version, description, script)
WHERE NOT EXISTS (
    SELECT 1
      FROM flyway_schema_history
     WHERE version = hint.version
);

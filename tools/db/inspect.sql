-- inspect.sql
-- 현재 DB의 사용자 오브젝트에 대한 요약/상세: 테이블/컬럼, 인덱스, 트리거, ENUM 타입
-- 시스템 스키마(pg_catalog, information_schema) 제외

-- 0) 보기 편의 (psql에서만; 다른 클라이언트면 무시됨)
-- \pset pager off
-- \x off

/**************************************************************
 * 1) 테이블 + 열 상세 (타입/NULL/DEFAULT/PK 여부/코멘트)
 **************************************************************/
WITH cols AS (
  SELECT
    n.nspname                         AS schema,
    c.relname                         AS table,
    a.attnum,
    a.attname                         AS column,
    pg_catalog.format_type(a.atttypid, a.atttypmod) AS data_type,
    (NOT a.attnotnull)                AS is_nullable,
    pg_get_expr(ad.adbin, ad.adrelid) AS column_default,
    EXISTS (
      SELECT 1
      FROM pg_index i
      WHERE i.indrelid = c.oid
        AND i.indisprimary
        AND a.attnum = ANY (i.indkey)
    ) AS is_primary_key,
    col_description(c.oid, a.attnum)  AS comment
  FROM pg_attribute a
  JOIN pg_class     c ON c.oid = a.attrelid AND c.relkind = 'r'  -- 테이블만
  JOIN pg_namespace n ON n.oid = c.relnamespace
  LEFT JOIN pg_attrdef ad ON ad.adrelid = c.oid AND ad.adnum = a.attnum
  WHERE n.nspname NOT IN ('pg_catalog','information_schema')
    AND a.attnum > 0
    AND NOT a.attisdropped
)
SELECT *
FROM cols
ORDER BY schema, table, attnum;

-- 1-보조) 테이블 사이즈/행수 대략 보기
SELECT
  n.nspname AS schema,
  c.relname AS table,
  pg_size_pretty(pg_total_relation_size(c.oid)) AS total_size,
  pg_size_pretty(pg_relation_size(c.oid))       AS table_size,
  pg_size_pretty(pg_indexes_size(c.oid))        AS indexes_size,
  c.reltuples::bigint                           AS approx_rows
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname NOT IN ('pg_catalog','information_schema')
  AND c.relkind = 'r'
ORDER BY pg_total_relation_size(c.oid) DESC;

 /**************************************************************
 * 2) 인덱스 전체 (정의/유니크/부분 인덱스 여부)
 **************************************************************/
SELECT
  i.schemaname AS schema,
  i.tablename  AS table,
  i.indexname  AS index,
  idx.indisunique AS is_unique,
  idx.indispartial AS is_partial,
  i.indexdef   AS definition
FROM pg_indexes i
JOIN pg_class t   ON t.relname = i.tablename
JOIN pg_namespace n ON n.oid = t.relnamespace AND n.nspname = i.schemaname
JOIN pg_class ic  ON ic.relname = i.indexname
JOIN pg_index idx ON idx.indexrelid = ic.oid
WHERE i.schemaname NOT IN ('pg_catalog','information_schema')
ORDER BY i.schemaname, i.tablename, i.indexname;

-- 2-보조) 제약(Primary/Unique/Check/Foreign/Exclusion) 정의
SELECT
  n.nspname AS schema,
  c.relname AS table,
  con.conname AS constraint_name,
  CASE con.contype
    WHEN 'p' THEN 'PRIMARY KEY'
    WHEN 'u' THEN 'UNIQUE'
    WHEN 'c' THEN 'CHECK'
    WHEN 'f' THEN 'FOREIGN KEY'
    WHEN 'x' THEN 'EXCLUSION'
    ELSE con.contype::text
  END AS constraint_type,
  pg_get_constraintdef(con.oid) AS definition
FROM pg_constraint con
JOIN pg_class c      ON c.oid = con.conrelid
JOIN pg_namespace n  ON n.oid = c.relnamespace
WHERE n.nspname NOT IN ('pg_catalog','information_schema')
ORDER BY schema, table, constraint_type, constraint_name;

 /**************************************************************
 * 3) 트리거 전체 (정의/활성상태/함수)
 **************************************************************/
SELECT
  n.nspname                          AS schema,
  c.relname                          AS table,
  t.tgname                           AS trigger,
  t.tgenabled                        AS enabled,     -- O=ON, D=DISABLED, R=REPLICA, A=ALWAYS
  pg_get_triggerdef(t.oid, true)     AS definition,
  pn.nspname || '.' || p.proname     AS function
FROM pg_trigger t
JOIN pg_class c      ON c.oid = t.tgrelid
JOIN pg_namespace n  ON n.oid = c.relnamespace
JOIN pg_proc p       ON p.oid = t.tgfoid
JOIN pg_namespace pn ON pn.oid = p.pronamespace
WHERE n.nspname NOT IN ('pg_catalog','information_schema')
  AND NOT t.tgisinternal
ORDER BY schema, table, trigger;

 /**************************************************************
 * 4) ENUM 타입 전체 (라벨/정렬순서)
 **************************************************************/
WITH enums AS (
  SELECT
    nt.nspname          AS schema,
    t.typname           AS enum_type,
    e.enumlabel,
    e.enumsortorder
  FROM pg_type t
  JOIN pg_enum e      ON e.enumtypid = t.oid
  JOIN pg_namespace nt ON nt.oid = t.typnamespace
  WHERE t.typtype = 'e'
    AND nt.nspname NOT IN ('pg_catalog','information_schema')
)
SELECT
  schema,
  enum_type,
  array_agg(enumlabel ORDER BY enumsortorder) AS labels
FROM enums
GROUP BY schema, enum_type
ORDER BY schema, enum_type;

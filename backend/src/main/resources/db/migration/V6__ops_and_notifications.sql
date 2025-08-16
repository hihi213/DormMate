
-- V6__ops_and_notifications.sql
-- Scope (post V5):
-- (1) Roles/permissions standardization helpers (view/function) + FRIDGE_INSPECT seed
-- (2) Access overrides helpers: active view, effect function (DENY priority), polymorphic FK validation, indexes
-- (3) Closure notifications (idempotency table) + banner/query views
-- (4) Study-room reservation reminders: subscriptions table, idempotency table, send function
-- (5) Book loan reminders/overdue notices: idempotency table, send function
-- (6) Auditing: generic audit function + triggers, index on activity_logs
-- (7) Monitoring/health views
--
-- Notes:
--  - Uses IF EXISTS / IF NOT EXISTS for idempotency.
--  - Scheduling/execution of reminder jobs is handled by the server (Quartz/EventBridge/etc.).
--  - Functions implement DB-side idempotency and notification recording only.

BEGIN;

-- =====================================================================
-- (1) Roles/permissions helpers + FRIDGE_INSPECT seed
-- =====================================================================

-- 1A) Effective permissions: role-based + per-user
CREATE OR REPLACE VIEW effective_permissions AS
SELECT u.user_id, rp.permission_code
FROM users u
JOIN role_permissions rp ON rp.role_id = u.role_id
UNION
SELECT up.user_id, up.permission_code FROM user_permissions up;

-- 1B) Standard permission check
CREATE OR REPLACE FUNCTION has_permission(p_user BIGINT, p_code VARCHAR)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM effective_permissions ep
    WHERE ep.user_id = p_user AND ep.permission_code = p_code
  );
$$;

-- 1C) Seed: fridge inspection permission (for resident inspectors via per-user grant)
INSERT INTO permissions(permission_code, description)
VALUES ('FRIDGE_INSPECT', '냉장고 현장 검사/폐기 확정 권한')
ON CONFLICT (permission_code) DO NOTHING;

-- =====================================================================
-- (2) Access overrides helpers: active view, effect function, validation trigger, indexes
-- =====================================================================

-- 2A) Active overrides (exclude expired)
CREATE OR REPLACE VIEW active_access_overrides AS
SELECT *
FROM access_overrides
WHERE (expires_at IS NULL OR expires_at > now());

-- 2B) Effect resolver (DENY has priority; if any DENY exists -> DENY; else if any ALLOW exists -> ALLOW; else NULL)
CREATE OR REPLACE FUNCTION override_effect(
  p_subject_type VARCHAR, p_subject_id BIGINT,
  p_resource_type VARCHAR, p_resource_id BIGINT
) RETURNS VARCHAR
LANGUAGE sql
STABLE
AS $$
  WITH cand AS (
    SELECT effect
    FROM active_access_overrides
    WHERE subject_type = p_subject_type
      AND subject_id   = p_subject_id
      AND resource_type = p_resource_type
      AND resource_id   = p_resource_id
  )
  SELECT CASE
           WHEN EXISTS (SELECT 1 FROM cand WHERE effect = 'DENY')  THEN 'DENY'
           WHEN EXISTS (SELECT 1 FROM cand WHERE effect = 'ALLOW') THEN 'ALLOW'
           ELSE NULL
         END;
$$;

-- 2C) Polymorphic subject validation trigger (USER/ROLE existence)
CREATE OR REPLACE FUNCTION validate_access_override_subject()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE v_exists boolean;
BEGIN
  IF NEW.subject_type = 'USER' THEN
    SELECT TRUE INTO v_exists FROM users WHERE user_id = NEW.subject_id;
  ELSIF NEW.subject_type = 'ROLE' THEN
    SELECT TRUE INTO v_exists FROM roles WHERE role_id = NEW.subject_id;
  ELSE
    RAISE EXCEPTION 'Invalid subject_type: % (expected USER or ROLE)', NEW.subject_type;
  END IF;

  IF NOT v_exists THEN
    RAISE EXCEPTION 'Subject not found: %:%', NEW.subject_type, NEW.subject_id;
  END IF;

  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS trg_validate_ao_subject ON access_overrides;
CREATE TRIGGER trg_validate_ao_subject
BEFORE INSERT OR UPDATE OF subject_type, subject_id
ON access_overrides
FOR EACH ROW
EXECUTE FUNCTION validate_access_override_subject();

-- 2D) Helpful indexes
CREATE INDEX IF NOT EXISTS ix_access_overrides_subj_res
  ON access_overrides(subject_type, subject_id, resource_type, resource_id);
CREATE INDEX IF NOT EXISTS ix_access_overrides_expires_at
  ON access_overrides(expires_at);

-- =====================================================================
-- (3) Closure notifications (idempotency) + banner/query views
-- =====================================================================

-- 3A) Idempotency keys for closure notices
CREATE TABLE IF NOT EXISTS closure_notice_keys (
  id BIGSERIAL PRIMARY KEY,
  closure_id   BIGINT  NOT NULL,
  recipient_id BIGINT  NOT NULL,
  stage        TEXT    NOT NULL,         -- 'T-7' | 'T-1' | 'START' | 'END'
  sent_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (closure_id, recipient_id, stage)
);

-- 3B) Banner/query helper views
CREATE OR REPLACE VIEW active_closures_now AS
SELECT closure_id, starts_at, ends_at, note
FROM closure_windows
WHERE is_active AND now() BETWEEN starts_at AND ends_at;

CREATE OR REPLACE VIEW upcoming_closures AS
SELECT closure_id, starts_at, ends_at, note
FROM closure_windows
WHERE is_active AND starts_at BETWEEN now() AND now() + interval '7 day'
ORDER BY starts_at;

-- =====================================================================
-- (4) Study-room reservation reminders (PWA/Web Push support)
-- =====================================================================

-- 4A) Web Push subscription registry
CREATE TABLE IF NOT EXISTS user_notification_subscriptions (
  subscription_id BIGSERIAL PRIMARY KEY,
  user_id   BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  endpoint  TEXT   NOT NULL,
  p256dh    TEXT   NOT NULL,
  auth      TEXT   NOT NULL,
  platform  VARCHAR(20),
  is_active boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_uns_endpoint ON user_notification_subscriptions(endpoint);
CREATE INDEX  IF NOT EXISTS ix_uns_user_active ON user_notification_subscriptions(user_id) WHERE is_active;

-- 4B) Idempotency keys for reservation reminders
CREATE TABLE IF NOT EXISTS reservation_notice_keys (
  id BIGSERIAL PRIMARY KEY,
  reservation_id BIGINT NOT NULL,
  stage          TEXT   NOT NULL,        -- 'T-24h' | 'T-1h' | 'T-15m'
  recipient_id   BIGINT NOT NULL,
  sent_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (reservation_id, stage, recipient_id)
);

-- 4C) Sender function (server scheduler calls at exact time)
CREATE OR REPLACE FUNCTION send_study_reservation_reminder(p_reservation_id BIGINT, p_stage TEXT)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_user_id BIGINT;
BEGIN
  -- Host only (attendees not modeled yet)
  SELECT user_id INTO v_user_id
  FROM study_room_reservations
  WHERE reservation_id = p_reservation_id
    AND status = 'RESERVED';

  IF v_user_id IS NULL THEN
    RETURN;
  END IF;

  -- Idempotency
  INSERT INTO reservation_notice_keys(reservation_id, stage, recipient_id)
  VALUES (p_reservation_id, p_stage, v_user_id)
  ON CONFLICT DO NOTHING;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Record notification (delivery to Web Push is app responsibility)
  INSERT INTO notifications(
    recipient_id, content, notification_type_code,
    related_entity_type, related_entity_id
  )
  VALUES (
    v_user_id,
    format('[스터디룸 %s] 예약 리마인더\n예약 ID: %s', p_stage, p_reservation_id),
    'STUDY_RESERVATION_REM',
    'STUDY_RESERVATION', p_reservation_id
  );
END
$$;

-- =====================================================================
-- (5) Book loan reminders/overdue notices (PWA/Web Push support)
-- =====================================================================

-- 5A) Idempotency keys for loan notices
CREATE TABLE IF NOT EXISTS loan_notice_keys (
  id BIGSERIAL PRIMARY KEY,
  loan_id       BIGINT NOT NULL,
  stage         TEXT   NOT NULL,         -- 'T-24h' | 'T-1h' | 'D+1' | 'D+3' | 'D+7'
  recipient_id  BIGINT NOT NULL,
  sent_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (loan_id, stage, recipient_id)
);

-- 5B) Sender function
CREATE OR REPLACE FUNCTION send_loan_notice(p_loan_id BIGINT, p_stage TEXT)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_user_id BIGINT;
  v_due     timestamptz;
BEGIN
  -- Only pending (not returned) loans
  SELECT user_id, due_date INTO v_user_id, v_due
  FROM book_loans
  WHERE loan_id = p_loan_id AND return_date IS NULL;

  IF v_user_id IS NULL THEN
    RETURN;
  END IF;

  -- Idempotency
  INSERT INTO loan_notice_keys(loan_id, stage, recipient_id)
  VALUES (p_loan_id, p_stage, v_user_id)
  ON CONFLICT DO NOTHING;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Record notification
  INSERT INTO notifications(
    recipient_id, content, notification_type_code,
    related_entity_type, related_entity_id
  )
  VALUES (
    v_user_id,
    format('[도서 %s] 반납 예정/연체 알림\n대출 ID: %s', p_stage, p_loan_id),
    'BOOK_DUE',
    'BOOK_LOAN', p_loan_id
  );
END
$$;

-- =====================================================================
-- (6) Auditing: generic audit function + triggers, index
-- =====================================================================

-- 6A) Generic audit function
CREATE OR REPLACE FUNCTION audit_row_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_actor BIGINT;
  v_action TEXT;
  v_details JSONB;
BEGIN
  v_actor := NULLIF(current_setting('app.user_id', true), '')::BIGINT;
  v_action := TG_TABLE_NAME || '_' || TG_OP;

  IF TG_OP = 'DELETE' THEN
    v_details := jsonb_build_object('old', to_jsonb(OLD));
  ELSE
    v_details := jsonb_build_object('old', to_jsonb(OLD), 'new', to_jsonb(NEW));
  END IF;

  INSERT INTO activity_logs(user_id, action_type, details, occurred_at)
  VALUES (v_actor, v_action, v_details, now());

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END
$$;

-- 6B) Attach audit triggers
DROP TRIGGER IF EXISTS trg_audit_access_overrides ON access_overrides;
CREATE TRIGGER trg_audit_access_overrides
AFTER INSERT OR UPDATE OR DELETE ON access_overrides
FOR EACH ROW EXECUTE FUNCTION audit_row_change();

DROP TRIGGER IF EXISTS trg_audit_role_permissions ON role_permissions;
CREATE TRIGGER trg_audit_role_permissions
AFTER INSERT OR UPDATE OR DELETE ON role_permissions
FOR EACH ROW EXECUTE FUNCTION audit_row_change();

DROP TRIGGER IF EXISTS trg_audit_user_permissions ON user_permissions;
CREATE TRIGGER trg_audit_user_permissions
AFTER INSERT OR UPDATE OR DELETE ON user_permissions
FOR EACH ROW EXECUTE FUNCTION audit_row_change();

DROP TRIGGER IF EXISTS trg_audit_closure_windows ON closure_windows;
CREATE TRIGGER trg_audit_closure_windows
AFTER INSERT OR UPDATE OR DELETE ON closure_windows
FOR EACH ROW EXECUTE FUNCTION audit_row_change();

DROP TRIGGER IF EXISTS trg_audit_system_settings ON system_settings;
CREATE TRIGGER trg_audit_system_settings
AFTER INSERT OR UPDATE OR DELETE ON system_settings
FOR EACH ROW EXECUTE FUNCTION audit_row_change();

-- 6C) Helpful index for retention/queries
CREATE INDEX IF NOT EXISTS ix_activity_logs_occurred_at ON activity_logs(occurred_at);

-- =====================================================================
-- (7) Monitoring/health views
-- =====================================================================

-- 7A) Overdue loans snapshot
CREATE OR REPLACE VIEW overdue_loans_view AS
SELECT loan_id, user_id, due_date, (now() - due_date) AS overdue_for
FROM book_loans
WHERE return_date IS NULL AND now() > due_date;

-- 7B) Upcoming reservations (24h)
CREATE OR REPLACE VIEW upcoming_reservations_view AS
SELECT reservation_id, user_id, start_time, end_time
FROM study_room_reservations
WHERE status = 'RESERVED'
  AND start_time BETWEEN now() AND now() + interval '24 hour'
ORDER BY start_time;

-- 7C) Push subscription stats
CREATE OR REPLACE VIEW push_subscription_stats AS
SELECT
  COUNT(*) FILTER (WHERE is_active)     AS active_subscriptions,
  COUNT(*) FILTER (WHERE NOT is_active) AS inactive_subscriptions,
  MAX(last_seen_at)                     AS last_seen_max
FROM user_notification_subscriptions;

COMMIT;

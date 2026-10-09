package com.dormmate.backend.modules.admin.application;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@Transactional
public class ResidentLifecycleService {
    private final JdbcTemplate jdbc;
    private final PasswordEncoder encoder;
    public ResidentLifecycleService(JdbcTemplate jdbc, PasswordEncoder encoder) {
        this.jdbc = jdbc; this.encoder = encoder;
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> listSlots() {
        return jdbc.queryForList("""
            SELECT s.id, r.floor, concat(r.floor,r.room_number) AS "roomNumber",
                   s.personal_no AS "personalNo", u.id AS "userId", u.login_id AS "loginId",
                   u.full_name AS "displayName", u.status, u.must_change_password AS "mustChangePassword",
                   EXISTS(SELECT 1 FROM room_assignment a WHERE a.dorm_user_id=u.id AND a.released_at IS NULL) AS occupied
            FROM resident_account_slot s JOIN room r ON r.id=s.room_id
            JOIN dorm_user u ON u.id=s.current_user_id
            ORDER BY r.floor,r.room_number,s.personal_no
            """);
    }

    public void checkIn(UUID slotId, String name, String email, String reason, UUID actor) {
        requireText(name, 100, "NAME_REQUIRED"); requireText(reason, 500, "REASON_REQUIRED");
        var slot = lockSlot(slotId); UUID user = (UUID) slot.get("current_user_id");
        var account = lockUser(user);
        if (!"INACTIVE".equals(account.get("status")) || exists(
                "SELECT EXISTS(SELECT 1 FROM room_assignment WHERE dorm_user_id=?)", user)) {
            throw failure(HttpStatus.CONFLICT, "SLOT_ALREADY_OCCUPIED_OR_HAS_HISTORY");
        }
        if (email != null && !email.isBlank() && (email.length() > 320 || !email.matches("[^\\s@]+@[^\\s@]+\\.[^\\s@]+"))) {
            throw failure(HttpStatus.UNPROCESSABLE_ENTITY, "INVALID_EMAIL");
        }
        jdbc.update("""
            UPDATE dorm_user SET full_name=?, email=?, status='ACTIVE', deactivated_at=NULL,
            password_hash=?, must_change_password=TRUE, credential_version=credential_version+1, updated_at=now() WHERE id=?
            """, name.trim(), email == null || email.isBlank() ? account.get("email") : email.trim(), encoder.encode("0000"), user);
        jdbc.update("""
            INSERT INTO room_assignment(id,room_id,dorm_user_id,personal_no,assigned_at)
            VALUES(gen_random_uuid(),?,?,?,now())
            """, slot.get("room_id"), user, slot.get("personal_no"));
        jdbc.update("""
            INSERT INTO user_role(id,dorm_user_id,role_code,granted_at,granted_by)
            SELECT gen_random_uuid(),?,'RESIDENT',now(),?
            WHERE NOT EXISTS(SELECT 1 FROM user_role WHERE dorm_user_id=? AND role_code='RESIDENT' AND revoked_at IS NULL)
            """, user, actor, user);
        revokeSessions(user, "CHECKED_IN"); audit("RESIDENT_CHECKED_IN", user, actor, reason);
    }

    public void resetPassword(UUID slotId, UUID expectedUserId, String reason, UUID actor) {
        requireText(reason, 500, "REASON_REQUIRED");
        var slot = lockSlot(slotId); UUID user = currentUser(slot, expectedUserId);
        var account = lockUser(user);
        if (!"ACTIVE".equals(account.get("status"))) throw failure(HttpStatus.CONFLICT, "RESIDENT_NOT_ACTIVE");
        reset(user); audit("RESIDENT_PASSWORD_RESET", user, actor, reason);
    }

    public void checkOut(UUID slotId, UUID expectedUserId, String reason, UUID actor) {
        requireText(reason, 500, "REASON_REQUIRED");
        var slot = lockSlot(slotId); UUID user = currentUser(slot, expectedUserId);
        var account = lockUser(user);
        if (!exists("SELECT EXISTS(SELECT 1 FROM room_assignment WHERE dorm_user_id=? AND released_at IS NULL)", user)) {
            throw failure(HttpStatus.CONFLICT, "RESIDENT_NOT_ASSIGNED");
        }
        if (exists("SELECT EXISTS(SELECT 1 FROM inspection_session WHERE started_by=? AND status='IN_PROGRESS')", user)) {
            throw failure(HttpStatus.CONFLICT, "ACTIVE_INSPECTION_EXISTS");
        }
        reset(user);
        jdbc.update("UPDATE room_assignment SET released_at=now(),updated_at=now() WHERE dorm_user_id=? AND released_at IS NULL", user);
        jdbc.update("UPDATE user_role SET revoked_at=now(),updated_at=now() WHERE dorm_user_id=? AND revoked_at IS NULL", user);
        jdbc.update("UPDATE dorm_user SET status='INACTIVE',retired_at=now(),deactivated_at=now(),updated_at=now() WHERE id=?", user);
        UUID next = UUID.randomUUID();
        jdbc.update("""
            INSERT INTO dorm_user(id,login_id,password_hash,full_name,email,status,must_change_password)
            VALUES(?,?,?,'미입사',?,'INACTIVE',TRUE)
            """, next, account.get("login_id"), encoder.encode("0000"), account.get("login_id") + "@unassigned.invalid");
        jdbc.update("UPDATE resident_account_slot SET current_user_id=? WHERE id=?", next, slotId);
        audit("RESIDENT_CHECKED_OUT", user, actor, reason);
    }

    public void changePassword(UUID user, long expectedVersion, String current, String replacement) {
        if (replacement == null || replacement.length() < 8 || replacement.getBytes(StandardCharsets.UTF_8).length > 72
                || replacement.isBlank() || replacement.equals(current)) {
            throw failure(HttpStatus.UNPROCESSABLE_ENTITY, "PASSWORD_POLICY_VIOLATION");
        }
        var account = lockUser(user);
        if (!"ACTIVE".equals(account.get("status")) || account.get("retired_at") != null
                || ((Number) account.get("credential_version")).longValue() != expectedVersion) {
            throw failure(HttpStatus.UNAUTHORIZED, "CREDENTIALS_CHANGED");
        }
        if (current == null || !encoder.matches(current, (String) account.get("password_hash"))) {
            throw failure(HttpStatus.FORBIDDEN, "CURRENT_PASSWORD_MISMATCH");
        }
        jdbc.update("UPDATE dorm_user SET password_hash=?,must_change_password=FALSE,credential_version=credential_version+1,updated_at=now() WHERE id=?",
                encoder.encode(replacement), user);
        revokeSessions(user, "PASSWORD_CHANGED"); audit("PASSWORD_CHANGED", user, user, "SELF_SERVICE");
    }

    private void reset(UUID user) {
        jdbc.update("UPDATE dorm_user SET password_hash=?,must_change_password=TRUE,credential_version=credential_version+1,updated_at=now() WHERE id=?", encoder.encode("0000"), user);
        revokeSessions(user, "PASSWORD_RESET");
    }
    private void revokeSessions(UUID user, String reason) {
        jdbc.update("UPDATE user_session SET revoked_at=now(),revoked_reason=?,updated_at=now() WHERE dorm_user_id=? AND revoked_at IS NULL", reason, user);
    }
    private Map<String,Object> lockSlot(UUID id) {
        var rows = jdbc.queryForList("SELECT * FROM resident_account_slot WHERE id=? FOR UPDATE", id);
        if (rows.isEmpty()) throw failure(HttpStatus.NOT_FOUND, "SLOT_NOT_FOUND");
        return rows.get(0);
    }
    private Map<String,Object> lockUser(UUID id) {
        var rows = jdbc.queryForList("SELECT * FROM dorm_user WHERE id=? FOR UPDATE", id);
        if (rows.isEmpty()) throw failure(HttpStatus.NOT_FOUND, "USER_NOT_FOUND");
        return rows.get(0);
    }
    private UUID currentUser(Map<String,Object> slot, UUID expected) {
        UUID user = (UUID) slot.get("current_user_id");
        if (!user.equals(expected)) throw failure(HttpStatus.CONFLICT, "OCCUPANT_CHANGED");
        return user;
    }
    private boolean exists(String sql, Object... values) { return Boolean.TRUE.equals(jdbc.queryForObject(sql, Boolean.class, values)); }
    private void audit(String action, UUID user, UUID actor, String reason) {
        jdbc.update("INSERT INTO audit_log(action_type,resource_type,resource_key,actor_user_id,detail) VALUES(?,'USER',?,?,jsonb_build_object('reason',CAST(? AS text)))",
                action, user.toString(), actor, reason.trim());
    }
    private void requireText(String value, int max, String code) {
        if (value == null || value.isBlank() || value.length() > max) throw failure(HttpStatus.UNPROCESSABLE_ENTITY, code);
    }
    private ResponseStatusException failure(HttpStatus status, String code) { return new ResponseStatusException(status, code); }
}

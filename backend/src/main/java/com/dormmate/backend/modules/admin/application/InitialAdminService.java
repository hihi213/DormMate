package com.dormmate.backend.modules.admin.application;

import java.nio.charset.StandardCharsets;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class InitialAdminService {
    private final JdbcTemplate jdbc;
    private final PasswordEncoder encoder;

    public InitialAdminService(JdbcTemplate jdbc, PasswordEncoder encoder) {
        this.jdbc = jdbc;
        this.encoder = encoder;
    }

    @Transactional
    public boolean createOnce(String loginId, String password, String name, String email) {
        // Serialize bootstrap across simultaneous application instances.
        jdbc.execute("SELECT pg_advisory_xact_lock(714230901)");
        if (Boolean.TRUE.equals(jdbc.queryForObject(
                "SELECT EXISTS(SELECT 1 FROM admin_bootstrap_state WHERE id=1)", Boolean.class))) {
            return false;
        }
        // An existing administrator must never be replaced, even if inactive/revoked.
        if (Boolean.TRUE.equals(jdbc.queryForObject(
                "SELECT EXISTS(SELECT 1 FROM user_role WHERE role_code='ADMIN')", Boolean.class))) {
            jdbc.update("INSERT INTO admin_bootstrap_state(id) VALUES(1)");
            return false;
        }
        if (loginId == null || !loginId.matches("[a-zA-Z0-9._-]{3,50}")
                || password == null || password.length() < 12
                || password.getBytes(StandardCharsets.UTF_8).length > 72
                || name == null || name.isBlank() || name.length() > 100
                || email == null || email.length() > 320 || !email.matches("[^\\s@]+@[^\\s@]+\\.[^\\s@]+")) {
            throw new IllegalArgumentException("Invalid bootstrap credentials: login 3-50 ASCII characters, password 12+ characters / <=72 UTF-8 bytes, name and email required");
        }
        if (Boolean.TRUE.equals(jdbc.queryForObject(
                "SELECT EXISTS(SELECT 1 FROM dorm_user WHERE lower(login_id)=lower(?))", Boolean.class, loginId))) {
            throw new IllegalStateException("Bootstrap login already belongs to an existing account");
        }
        UUID id = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO dorm_user(id, login_id, password_hash, full_name, email, status)
                VALUES (?, ?, ?, ?, ?, 'ACTIVE')
                """, id, loginId, encoder.encode(password), name, email);
        jdbc.update("""
                INSERT INTO user_role(id, dorm_user_id, role_code, granted_at)
                VALUES (?, ?, 'ADMIN', CURRENT_TIMESTAMP)
                """, UUID.randomUUID(), id);
        jdbc.update("""
                INSERT INTO audit_log(action_type, resource_type, resource_key, actor_user_id)
                VALUES ('INITIAL_ADMIN_CREATED', 'USER', ?, ?)
                """, id.toString(), id);
        jdbc.update("INSERT INTO admin_bootstrap_state(id) VALUES(1)");
        return true;
    }
}

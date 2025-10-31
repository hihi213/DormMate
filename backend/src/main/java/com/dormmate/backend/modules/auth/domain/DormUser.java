package com.dormmate.backend.modules.auth.domain;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import com.dormmate.backend.global.jpa.AbstractTimestampedEntity;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;

import org.hibernate.annotations.UuidGenerator;

/**
 * DormMate 사용자 계정 엔터티.
 */
@Entity
@Table(name = "dorm_user")
public class DormUser extends AbstractTimestampedEntity {

    @Id
    @UuidGenerator
    @Column(name = "id", nullable = false, updatable = false, columnDefinition = "uuid")
    private UUID id;

    @Column(name = "login_id", nullable = false, unique = true, length = 50)
    private String loginId;

    @Column(name = "password_hash", nullable = false, length = 255)
    private String passwordHash;

    @Column(name = "full_name", nullable = false, length = 100)
    private String fullName;

    @Column(name = "email", nullable = false, length = 320)
    private String email;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 16)
    private DormUserStatus status;

    @Column(name = "deactivated_at")
    private OffsetDateTime deactivatedAt;

    @OneToMany(mappedBy = "dormUser", cascade = CascadeType.ALL, fetch = FetchType.LAZY, orphanRemoval = false)
    private List<UserRole> roles = new ArrayList<>();

    @OneToMany(mappedBy = "dormUser", cascade = CascadeType.ALL, fetch = FetchType.LAZY, orphanRemoval = false)
    private List<UserSession> sessions = new ArrayList<>();

    @OneToMany(mappedBy = "dormUser", cascade = CascadeType.ALL, fetch = FetchType.LAZY, orphanRemoval = false)
    private List<RoomAssignment> roomAssignments = new ArrayList<>();

    public UUID getId() {
        return id;
    }

    public String getLoginId() {
        return loginId;
    }

    public void setLoginId(String loginId) {
        this.loginId = loginId;
    }

    public String getPasswordHash() {
        return passwordHash;
    }

    public void setPasswordHash(String passwordHash) {
        this.passwordHash = passwordHash;
    }

    public String getFullName() {
        return fullName;
    }

    public void setFullName(String fullName) {
        this.fullName = fullName;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public DormUserStatus getStatus() {
        return status;
    }

    public void setStatus(DormUserStatus status) {
        this.status = status;
    }

    public OffsetDateTime getDeactivatedAt() {
        return deactivatedAt;
    }

    public void setDeactivatedAt(OffsetDateTime deactivatedAt) {
        this.deactivatedAt = deactivatedAt;
    }

    public List<UserRole> getRoles() {
        return roles;
    }

    public List<UserSession> getSessions() {
        return sessions;
    }

    public List<RoomAssignment> getRoomAssignments() {
        return roomAssignments;
    }
}

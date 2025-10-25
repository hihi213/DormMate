package com.dormmate.backend.modules.auth.domain;

import java.time.OffsetDateTime;
import java.util.UUID;

import com.dormmate.backend.global.jpa.AbstractTimestampedEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import org.hibernate.annotations.UuidGenerator;

/**
 * 사용자-역할 매핑 엔터티.
 */
@Entity
@Table(name = "user_role")
public class UserRole extends AbstractTimestampedEntity {

    @Id
    @UuidGenerator
    @Column(name = "id", nullable = false, updatable = false, columnDefinition = "uuid")
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "dorm_user_id", nullable = false)
    private DormUser dormUser;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "role_code", nullable = false)
    private Role role;

    @Column(name = "granted_at", nullable = false)
    private OffsetDateTime grantedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "granted_by")
    private DormUser grantedBy;

    @Column(name = "revoked_at")
    private OffsetDateTime revokedAt;

    public UUID getId() {
        return id;
    }

    public DormUser getDormUser() {
        return dormUser;
    }

    public void setDormUser(DormUser dormUser) {
        this.dormUser = dormUser;
    }

    public Role getRole() {
        return role;
    }

    public void setRole(Role role) {
        this.role = role;
    }

    public OffsetDateTime getGrantedAt() {
        return grantedAt;
    }

    public void setGrantedAt(OffsetDateTime grantedAt) {
        this.grantedAt = grantedAt;
    }

    public DormUser getGrantedBy() {
        return grantedBy;
    }

    public void setGrantedBy(DormUser grantedBy) {
        this.grantedBy = grantedBy;
    }

    public OffsetDateTime getRevokedAt() {
        return revokedAt;
    }

    public void setRevokedAt(OffsetDateTime revokedAt) {
        this.revokedAt = revokedAt;
    }

    public boolean isActive() {
        return revokedAt == null;
    }
}

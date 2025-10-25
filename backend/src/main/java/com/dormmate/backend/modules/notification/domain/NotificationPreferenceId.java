package com.dormmate.backend.modules.notification.domain;

import java.io.Serializable;
import java.util.Objects;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;

@Embeddable
public class NotificationPreferenceId implements Serializable {

    @Column(name = "user_id", nullable = false, columnDefinition = "uuid")
    private UUID userId;

    @Column(name = "kind_code", nullable = false, length = 50)
    private String kindCode;

    protected NotificationPreferenceId() {
    }

    public NotificationPreferenceId(UUID userId, String kindCode) {
        this.userId = userId;
        this.kindCode = kindCode;
    }

    public UUID getUserId() {
        return userId;
    }

    public String getKindCode() {
        return kindCode;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof NotificationPreferenceId that)) return false;
        return Objects.equals(userId, that.userId) && Objects.equals(kindCode, that.kindCode);
    }

    @Override
    public int hashCode() {
        return Objects.hash(userId, kindCode);
    }
}

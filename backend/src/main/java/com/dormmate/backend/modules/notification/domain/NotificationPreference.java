package com.dormmate.backend.modules.notification.domain;

import com.dormmate.backend.global.jpa.AbstractTimestampedEntity;
import com.dormmate.backend.modules.auth.domain.DormUser;

import jakarta.persistence.Column;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.MapsId;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

@Entity
@Table(name = "notification_preference")
public class NotificationPreference extends AbstractTimestampedEntity {

    @EmbeddedId
    private NotificationPreferenceId id;

    @MapsId("userId")
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private DormUser user;

    @Column(name = "is_enabled", nullable = false)
    private boolean enabled = true;

    @Column(name = "allow_background", nullable = false)
    private boolean allowBackground = true;

    protected NotificationPreference() {
    }

    public NotificationPreference(NotificationPreferenceId id, DormUser user) {
        this.id = id;
        this.user = user;
    }

    public NotificationPreferenceId getId() {
        return id;
    }

    public DormUser getUser() {
        return user;
    }

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public boolean isAllowBackground() {
        return allowBackground;
    }

    public void setAllowBackground(boolean allowBackground) {
        this.allowBackground = allowBackground;
    }
}

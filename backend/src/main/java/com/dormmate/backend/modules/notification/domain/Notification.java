package com.dormmate.backend.modules.notification.domain;

import java.time.OffsetDateTime;
import java.util.Map;
import java.util.UUID;

import com.dormmate.backend.global.jpa.AbstractTimestampedEntity;
import com.dormmate.backend.modules.auth.domain.DormUser;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import org.hibernate.annotations.UuidGenerator;

@Entity
@Table(name = "notification")
public class Notification extends AbstractTimestampedEntity {

    @Id
    @UuidGenerator
    @Column(name = "id", nullable = false, updatable = false, columnDefinition = "uuid")
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private DormUser user;

    @Column(name = "kind_code", nullable = false, length = 50)
    private String kindCode;

    @Column(name = "title", nullable = false, length = 200)
    private String title;

    @Column(name = "body", nullable = false)
    private String body;

    @Enumerated(EnumType.STRING)
    @Column(name = "state", nullable = false, length = 16)
    private NotificationState state = NotificationState.UNREAD;

    @Column(name = "dedupe_key", length = 100)
    private String dedupeKey;

    @Column(name = "ttl_at")
    private OffsetDateTime ttlAt;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "metadata", columnDefinition = "jsonb")
    private Map<String, Object> metadata;

    @Column(name = "correlation_id", columnDefinition = "uuid")
    private UUID correlationId;

    @Column(name = "allow_background", nullable = false)
    private boolean allowBackground = true;

    @Column(name = "read_at")
    private OffsetDateTime readAt;

    @Column(name = "expired_at")
    private OffsetDateTime expiredAt;

    public UUID getId() {
        return id;
    }

    public DormUser getUser() {
        return user;
    }

    public void setUser(DormUser user) {
        this.user = user;
    }

    public String getKindCode() {
        return kindCode;
    }

    public void setKindCode(String kindCode) {
        this.kindCode = kindCode;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getBody() {
        return body;
    }

    public void setBody(String body) {
        this.body = body;
    }

    public NotificationState getState() {
        return state;
    }

    public void setState(NotificationState state) {
        this.state = state;
    }

    public String getDedupeKey() {
        return dedupeKey;
    }

    public void setDedupeKey(String dedupeKey) {
        this.dedupeKey = dedupeKey;
    }

    public OffsetDateTime getTtlAt() {
        return ttlAt;
    }

    public void setTtlAt(OffsetDateTime ttlAt) {
        this.ttlAt = ttlAt;
    }

    public Map<String, Object> getMetadata() {
        return metadata;
    }

    public void setMetadata(Map<String, Object> metadata) {
        this.metadata = metadata;
    }

    public UUID getCorrelationId() {
        return correlationId;
    }

    public void setCorrelationId(UUID correlationId) {
        this.correlationId = correlationId;
    }

    public boolean isAllowBackground() {
        return allowBackground;
    }

    public void setAllowBackground(boolean allowBackground) {
        this.allowBackground = allowBackground;
    }

    public OffsetDateTime getReadAt() {
        return readAt;
    }

    public void setReadAt(OffsetDateTime readAt) {
        this.readAt = readAt;
    }

    public OffsetDateTime getExpiredAt() {
        return expiredAt;
    }

    public void setExpiredAt(OffsetDateTime expiredAt) {
        this.expiredAt = expiredAt;
    }

    public void markRead(OffsetDateTime now) {
        this.state = NotificationState.READ;
        this.readAt = now;
    }

    public void markExpired(OffsetDateTime now) {
        this.state = NotificationState.EXPIRED;
        this.expiredAt = now;
    }
}

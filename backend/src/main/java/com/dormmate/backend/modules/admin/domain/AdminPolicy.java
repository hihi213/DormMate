package com.dormmate.backend.modules.admin.domain;

import java.time.LocalTime;
import java.util.UUID;

import com.dormmate.backend.global.jpa.AbstractTimestampedEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "admin_policy")
public class AdminPolicy extends AbstractTimestampedEntity {

    @Id
    @Column(name = "id", nullable = false, updatable = false, columnDefinition = "uuid")
    private UUID id;

    @Column(name = "notification_batch_time", nullable = false)
    private LocalTime notificationBatchTime;

    @Column(name = "notification_daily_limit", nullable = false)
    private int notificationDailyLimit;

    @Column(name = "notification_ttl_hours", nullable = false)
    private int notificationTtlHours;

    @Column(name = "penalty_limit", nullable = false)
    private int penaltyLimit;

    @Column(name = "penalty_template", nullable = false)
    private String penaltyTemplate;

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public LocalTime getNotificationBatchTime() {
        return notificationBatchTime;
    }

    public void setNotificationBatchTime(LocalTime notificationBatchTime) {
        this.notificationBatchTime = notificationBatchTime;
    }

    public int getNotificationDailyLimit() {
        return notificationDailyLimit;
    }

    public void setNotificationDailyLimit(int notificationDailyLimit) {
        this.notificationDailyLimit = notificationDailyLimit;
    }

    public int getNotificationTtlHours() {
        return notificationTtlHours;
    }

    public void setNotificationTtlHours(int notificationTtlHours) {
        this.notificationTtlHours = notificationTtlHours;
    }

    public int getPenaltyLimit() {
        return penaltyLimit;
    }

    public void setPenaltyLimit(int penaltyLimit) {
        this.penaltyLimit = penaltyLimit;
    }

    public String getPenaltyTemplate() {
        return penaltyTemplate;
    }

    public void setPenaltyTemplate(String penaltyTemplate) {
        this.penaltyTemplate = penaltyTemplate;
    }
}

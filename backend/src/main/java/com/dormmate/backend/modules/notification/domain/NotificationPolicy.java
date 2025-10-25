package com.dormmate.backend.modules.notification.domain;

import com.dormmate.backend.global.jpa.AbstractTimestampedEntity;
import com.dormmate.backend.modules.auth.domain.DormUser;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

@Entity
@Table(name = "notification_policy")
public class NotificationPolicy extends AbstractTimestampedEntity {

    @Id
    @Column(name = "kind_code", nullable = false, length = 50)
    private String kindCode;

    @Column(name = "ttl_hours")
    private Integer ttlHours;

    @Column(name = "max_per_day")
    private Integer maxPerDay;

    @Column(name = "allow_background_default")
    private Boolean allowBackgroundDefault;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "updated_by")
    private DormUser updatedBy;

    public String getKindCode() {
        return kindCode;
    }

    public void setKindCode(String kindCode) {
        this.kindCode = kindCode;
    }

    public Integer getTtlHours() {
        return ttlHours;
    }

    public void setTtlHours(Integer ttlHours) {
        this.ttlHours = ttlHours;
    }

    public Integer getMaxPerDay() {
        return maxPerDay;
    }

    public void setMaxPerDay(Integer maxPerDay) {
        this.maxPerDay = maxPerDay;
    }

    public Boolean getAllowBackgroundDefault() {
        return allowBackgroundDefault;
    }

    public void setAllowBackgroundDefault(Boolean allowBackgroundDefault) {
        this.allowBackgroundDefault = allowBackgroundDefault;
    }

    public DormUser getUpdatedBy() {
        return updatedBy;
    }

    public void setUpdatedBy(DormUser updatedBy) {
        this.updatedBy = updatedBy;
    }
}

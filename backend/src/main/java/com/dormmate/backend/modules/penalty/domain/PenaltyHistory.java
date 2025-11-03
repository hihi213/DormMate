package com.dormmate.backend.modules.penalty.domain;

import java.time.OffsetDateTime;
import java.util.UUID;

import com.dormmate.backend.global.jpa.AbstractTimestampedEntity;
import com.dormmate.backend.modules.auth.domain.DormUser;
import com.dormmate.backend.modules.inspection.domain.InspectionAction;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import org.hibernate.annotations.UuidGenerator;

@Entity
@Table(name = "penalty_history")
public class PenaltyHistory extends AbstractTimestampedEntity {

    @Id
    @UuidGenerator
    @Column(name = "id", nullable = false, updatable = false, columnDefinition = "uuid")
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private DormUser user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "issuer_id")
    private DormUser issuer;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "inspection_action_id")
    private InspectionAction inspectionAction;

    @Column(name = "source", nullable = false, length = 50)
    private String source;

    @Column(name = "points", nullable = false)
    private int points;

    @Column(name = "reason", length = 120)
    private String reason;

    @Column(name = "issued_at", nullable = false)
    private OffsetDateTime issuedAt;

    @Column(name = "expires_at")
    private OffsetDateTime expiresAt;

    @Column(name = "correlation_id", columnDefinition = "uuid")
    private UUID correlationId;

    public UUID getId() {
        return id;
    }

    public DormUser getUser() {
        return user;
    }

    public void setUser(DormUser user) {
        this.user = user;
    }

    public DormUser getIssuer() {
        return issuer;
    }

    public void setIssuer(DormUser issuer) {
        this.issuer = issuer;
    }

    public InspectionAction getInspectionAction() {
        return inspectionAction;
    }

    public void setInspectionAction(InspectionAction inspectionAction) {
        this.inspectionAction = inspectionAction;
    }

    public String getSource() {
        return source;
    }

    public void setSource(String source) {
        this.source = source;
    }

    public int getPoints() {
        return points;
    }

    public void setPoints(int points) {
        this.points = points;
    }

    public String getReason() {
        return reason;
    }

    public void setReason(String reason) {
        this.reason = reason;
    }

    public OffsetDateTime getIssuedAt() {
        return issuedAt;
    }

    public void setIssuedAt(OffsetDateTime issuedAt) {
        this.issuedAt = issuedAt;
    }

    public OffsetDateTime getExpiresAt() {
        return expiresAt;
    }

    public void setExpiresAt(OffsetDateTime expiresAt) {
        this.expiresAt = expiresAt;
    }

    public UUID getCorrelationId() {
        return correlationId;
    }

    public void setCorrelationId(UUID correlationId) {
        this.correlationId = correlationId;
    }
}

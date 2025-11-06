package com.dormmate.backend.modules.inspection.domain;

import java.time.OffsetDateTime;
import java.util.Map;
import java.util.UUID;

import com.dormmate.backend.global.jpa.AbstractTimestampedEntity;
import com.dormmate.backend.modules.auth.domain.DormUser;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UuidGenerator;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "inspection_audit_log")
public class InspectionAuditLog extends AbstractTimestampedEntity {

    @Id
    @UuidGenerator
    @Column(name = "id", nullable = false, updatable = false, columnDefinition = "uuid")
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "inspection_session_id", nullable = false)
    private InspectionSession inspectionSession;

    @Column(name = "action_type", nullable = false, length = 64)
    private String actionType;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "detail", columnDefinition = "jsonb")
    private Map<String, Object> detail;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by")
    private DormUser createdBy;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();

    public UUID getId() {
        return id;
    }

    public InspectionSession getInspectionSession() {
        return inspectionSession;
    }

    public void setInspectionSession(InspectionSession inspectionSession) {
        this.inspectionSession = inspectionSession;
    }

    public String getActionType() {
        return actionType;
    }

    public void setActionType(String actionType) {
        this.actionType = actionType;
    }

    public Map<String, Object> getDetail() {
        return detail;
    }

    public void setDetail(Map<String, Object> detail) {
        this.detail = detail;
    }

    public DormUser getCreatedBy() {
        return createdBy;
    }

    public void setCreatedBy(DormUser createdBy) {
        this.createdBy = createdBy;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(OffsetDateTime createdAt) {
        this.createdAt = createdAt;
    }
}

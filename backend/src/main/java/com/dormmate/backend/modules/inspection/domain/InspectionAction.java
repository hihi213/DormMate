package com.dormmate.backend.modules.inspection.domain;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;

import com.dormmate.backend.global.jpa.AbstractTimestampedEntity;
import com.dormmate.backend.modules.auth.domain.DormUser;
import com.dormmate.backend.modules.fridge.domain.FridgeBundle;
import com.dormmate.backend.modules.penalty.domain.PenaltyHistory;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;

@Entity
@Table(name = "inspection_action")
public class InspectionAction extends AbstractTimestampedEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false, updatable = false)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "inspection_session_id", nullable = false)
    private InspectionSession inspectionSession;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "fridge_bundle_id")
    private FridgeBundle fridgeBundle;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "target_user_id")
    private DormUser targetUser;

    @Enumerated(EnumType.STRING)
    @Column(name = "action_type", nullable = false, length = 32)
    private InspectionActionType actionType;

    @Column(name = "reason_code", length = 32)
    private String reasonCode;

    @Column(name = "free_note")
    private String freeNote;

    @Column(name = "recorded_at", nullable = false)
    private OffsetDateTime recordedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "recorded_by", nullable = false)
    private DormUser recordedBy;

    @OneToMany(mappedBy = "inspectionAction", cascade = CascadeType.ALL, fetch = FetchType.LAZY, orphanRemoval = true)
    private List<InspectionActionItem> items = new ArrayList<>();

    @OneToMany(mappedBy = "inspectionAction", cascade = CascadeType.ALL, fetch = FetchType.LAZY, orphanRemoval = true)
    private List<PenaltyHistory> penalties = new ArrayList<>();

    public Long getId() {
        return id;
    }

    public InspectionSession getInspectionSession() {
        return inspectionSession;
    }

    public void setInspectionSession(InspectionSession inspectionSession) {
        this.inspectionSession = inspectionSession;
    }

    public FridgeBundle getFridgeBundle() {
        return fridgeBundle;
    }

    public void setFridgeBundle(FridgeBundle fridgeBundle) {
        this.fridgeBundle = fridgeBundle;
    }

    public DormUser getTargetUser() {
        return targetUser;
    }

    public void setTargetUser(DormUser targetUser) {
        this.targetUser = targetUser;
    }

    public InspectionActionType getActionType() {
        return actionType;
    }

    public void setActionType(InspectionActionType actionType) {
        this.actionType = actionType;
    }

    public String getReasonCode() {
        return reasonCode;
    }

    public void setReasonCode(String reasonCode) {
        this.reasonCode = reasonCode;
    }

    public String getFreeNote() {
        return freeNote;
    }

    public void setFreeNote(String freeNote) {
        this.freeNote = freeNote;
    }

    public OffsetDateTime getRecordedAt() {
        return recordedAt;
    }

    public void setRecordedAt(OffsetDateTime recordedAt) {
        this.recordedAt = recordedAt;
    }

    public DormUser getRecordedBy() {
        return recordedBy;
    }

    public void setRecordedBy(DormUser recordedBy) {
        this.recordedBy = recordedBy;
    }

    public List<InspectionActionItem> getItems() {
        return items;
    }

    public List<PenaltyHistory> getPenalties() {
        return penalties;
    }
}

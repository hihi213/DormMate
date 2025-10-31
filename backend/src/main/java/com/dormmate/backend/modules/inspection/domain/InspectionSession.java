package com.dormmate.backend.modules.inspection.domain;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import com.dormmate.backend.global.jpa.AbstractTimestampedEntity;
import com.dormmate.backend.modules.auth.domain.DormUser;
import com.dormmate.backend.modules.fridge.domain.FridgeCompartment;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;

import org.hibernate.annotations.UuidGenerator;

@Entity
@Table(name = "inspection_session")
public class InspectionSession extends AbstractTimestampedEntity {

    @Id
    @UuidGenerator
    @Column(name = "id", nullable = false, updatable = false, columnDefinition = "uuid")
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "fridge_compartment_id", nullable = false)
    private FridgeCompartment fridgeCompartment;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "started_by", nullable = false)
    private DormUser startedBy;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 16)
    private InspectionStatus status = InspectionStatus.IN_PROGRESS;

    @Column(name = "started_at", nullable = false)
    private OffsetDateTime startedAt;

    @Column(name = "ended_at")
    private OffsetDateTime endedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "submitted_by")
    private DormUser submittedBy;

    @Column(name = "submitted_at")
    private OffsetDateTime submittedAt;

    @Column(name = "total_bundle_count")
    private Integer totalBundleCount;

    @Column(name = "notes")
    private String notes;

    @OneToMany(mappedBy = "inspectionSession", cascade = CascadeType.ALL, fetch = FetchType.LAZY, orphanRemoval = true)
    private List<InspectionParticipant> participants = new ArrayList<>();

    @OneToMany(mappedBy = "inspectionSession", cascade = CascadeType.ALL, fetch = FetchType.LAZY, orphanRemoval = true)
    private List<InspectionAction> actions = new ArrayList<>();

    @OneToMany(mappedBy = "inspectionSession", cascade = CascadeType.ALL, fetch = FetchType.LAZY, orphanRemoval = true)
    private List<UnregisteredItemEvent> unregisteredItems = new ArrayList<>();

    public UUID getId() {
        return id;
    }

    public FridgeCompartment getFridgeCompartment() {
        return fridgeCompartment;
    }

    public void setFridgeCompartment(FridgeCompartment fridgeCompartment) {
        this.fridgeCompartment = fridgeCompartment;
    }

    public DormUser getStartedBy() {
        return startedBy;
    }

    public void setStartedBy(DormUser startedBy) {
        this.startedBy = startedBy;
    }

    public InspectionStatus getStatus() {
        return status;
    }

    public void setStatus(InspectionStatus status) {
        this.status = status;
    }

    public OffsetDateTime getStartedAt() {
        return startedAt;
    }

    public void setStartedAt(OffsetDateTime startedAt) {
        this.startedAt = startedAt;
    }

    public OffsetDateTime getEndedAt() {
        return endedAt;
    }

    public void setEndedAt(OffsetDateTime endedAt) {
        this.endedAt = endedAt;
    }

    public DormUser getSubmittedBy() {
        return submittedBy;
    }

    public void setSubmittedBy(DormUser submittedBy) {
        this.submittedBy = submittedBy;
    }

    public OffsetDateTime getSubmittedAt() {
        return submittedAt;
    }

    public void setSubmittedAt(OffsetDateTime submittedAt) {
        this.submittedAt = submittedAt;
    }

    public Integer getTotalBundleCount() {
        return totalBundleCount;
    }

    public void setTotalBundleCount(Integer totalBundleCount) {
        this.totalBundleCount = totalBundleCount;
    }

    public String getNotes() {
        return notes;
    }

    public void setNotes(String notes) {
        this.notes = notes;
    }

    public List<InspectionParticipant> getParticipants() {
        return participants;
    }

    public List<InspectionAction> getActions() {
        return actions;
    }

    public List<UnregisteredItemEvent> getUnregisteredItems() {
        return unregisteredItems;
    }
}

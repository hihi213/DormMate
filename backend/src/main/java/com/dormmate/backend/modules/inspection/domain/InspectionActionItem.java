package com.dormmate.backend.modules.inspection.domain;

import java.time.LocalDate;
import java.util.UUID;

import com.dormmate.backend.global.jpa.AbstractTimestampedEntity;
import com.dormmate.backend.modules.fridge.domain.FridgeItem;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

@Entity
@Table(name = "inspection_action_item")
public class InspectionActionItem extends AbstractTimestampedEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false, updatable = false)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "inspection_action_id", nullable = false)
    private InspectionAction inspectionAction;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "fridge_item_id")
    private FridgeItem fridgeItem;

    @Column(name = "snapshot_name", length = 120)
    private String snapshotName;

    @Column(name = "snapshot_expires_on")
    private LocalDate snapshotExpiresOn;

    @Column(name = "quantity_at_action")
    private Integer quantityAtAction;

    public Long getId() {
        return id;
    }

    public InspectionAction getInspectionAction() {
        return inspectionAction;
    }

    public void setInspectionAction(InspectionAction inspectionAction) {
        this.inspectionAction = inspectionAction;
    }

    public FridgeItem getFridgeItem() {
        return fridgeItem;
    }

    public void setFridgeItem(FridgeItem fridgeItem) {
        this.fridgeItem = fridgeItem;
    }

    public String getSnapshotName() {
        return snapshotName;
    }

    public void setSnapshotName(String snapshotName) {
        this.snapshotName = snapshotName;
    }

    public LocalDate getSnapshotExpiresOn() {
        return snapshotExpiresOn;
    }

    public void setSnapshotExpiresOn(LocalDate snapshotExpiresOn) {
        this.snapshotExpiresOn = snapshotExpiresOn;
    }

    public Integer getQuantityAtAction() {
        return quantityAtAction;
    }

    public void setQuantityAtAction(Integer quantityAtAction) {
        this.quantityAtAction = quantityAtAction;
    }
}

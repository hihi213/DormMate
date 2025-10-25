package com.dormmate.backend.modules.fridge.domain;

import java.time.OffsetDateTime;
import java.time.LocalDate;
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

import org.hibernate.annotations.UuidGenerator;

@Entity
@Table(name = "fridge_item")
public class FridgeItem extends AbstractTimestampedEntity {

    @Id
    @UuidGenerator
    @Column(name = "id", nullable = false, updatable = false, columnDefinition = "uuid")
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "fridge_bundle_id", nullable = false)
    private FridgeBundle bundle;

    @Column(name = "sequence_no", nullable = false)
    private int sequenceNo;

    @Column(name = "item_name", nullable = false, length = 120)
    private String itemName;

    @Column(name = "quantity", nullable = false)
    private int quantity;

    @Column(name = "unit", length = 16)
    private String unit;

    @Enumerated(EnumType.STRING)
    @Column(name = "priority", length = 16)
    private FridgeItemPriority priority;

    @Column(name = "expires_on", nullable = false)
    private LocalDate expiresOn;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 16)
    private FridgeItemStatus status = FridgeItemStatus.ACTIVE;

    @Column(name = "last_modified_at", nullable = false)
    private OffsetDateTime lastModifiedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "last_modified_by")
    private DormUser lastModifiedBy;

    @Column(name = "post_inspection_modified", nullable = false)
    private boolean postInspectionModified;

    @Column(name = "memo")
    private String memo;

    @Column(name = "deleted_at")
    private OffsetDateTime deletedAt;

    public UUID getId() {
        return id;
    }

    public FridgeBundle getBundle() {
        return bundle;
    }

    public void setBundle(FridgeBundle bundle) {
        this.bundle = bundle;
    }

    public int getSequenceNo() {
        return sequenceNo;
    }

    public void setSequenceNo(int sequenceNo) {
        this.sequenceNo = sequenceNo;
    }

    public String getItemName() {
        return itemName;
    }

    public void setItemName(String itemName) {
        this.itemName = itemName;
    }

    public int getQuantity() {
        return quantity;
    }

    public void setQuantity(int quantity) {
        this.quantity = quantity;
    }

    public String getUnit() {
        return unit;
    }

    public void setUnit(String unit) {
        this.unit = unit;
    }

    public FridgeItemPriority getPriority() {
        return priority;
    }

    public void setPriority(FridgeItemPriority priority) {
        this.priority = priority;
    }

    public LocalDate getExpiresOn() {
        return expiresOn;
    }

    public void setExpiresOn(LocalDate expiresOn) {
        this.expiresOn = expiresOn;
    }

    public FridgeItemStatus getStatus() {
        return status;
    }

    public void setStatus(FridgeItemStatus status) {
        this.status = status;
    }

    public OffsetDateTime getLastModifiedAt() {
        return lastModifiedAt;
    }

    public void setLastModifiedAt(OffsetDateTime lastModifiedAt) {
        this.lastModifiedAt = lastModifiedAt;
    }

    public DormUser getLastModifiedBy() {
        return lastModifiedBy;
    }

    public void setLastModifiedBy(DormUser lastModifiedBy) {
        this.lastModifiedBy = lastModifiedBy;
    }

    public boolean isPostInspectionModified() {
        return postInspectionModified;
    }

    public void setPostInspectionModified(boolean postInspectionModified) {
        this.postInspectionModified = postInspectionModified;
    }

    public String getMemo() {
        return memo;
    }

    public void setMemo(String memo) {
        this.memo = memo;
    }

    public OffsetDateTime getDeletedAt() {
        return deletedAt;
    }

    public void setDeletedAt(OffsetDateTime deletedAt) {
        this.deletedAt = deletedAt;
    }
}

package com.dormmate.backend.modules.fridge.domain;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

import com.dormmate.backend.global.jpa.AbstractTimestampedEntity;

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

    @Column(name = "item_name", nullable = false, length = 120)
    private String itemName;

    @Column(name = "quantity", nullable = false)
    private int quantity;

    @Column(name = "unit_code", length = 16)
    private String unitCode;

    @Column(name = "expiry_date", nullable = false)
    private LocalDate expiryDate;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 16)
    private FridgeItemStatus status = FridgeItemStatus.ACTIVE;

    @Column(name = "updated_after_inspection", nullable = false)
    private boolean updatedAfterInspection;

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

    public String getUnitCode() {
        return unitCode;
    }

    public void setUnitCode(String unitCode) {
        this.unitCode = unitCode;
    }

    public LocalDate getExpiryDate() {
        return expiryDate;
    }

    public void setExpiryDate(LocalDate expiryDate) {
        this.expiryDate = expiryDate;
    }

    public FridgeItemStatus getStatus() {
        return status;
    }

    public void setStatus(FridgeItemStatus status) {
        this.status = status;
    }

    public boolean isUpdatedAfterInspection() {
        return updatedAfterInspection;
    }

    public void setUpdatedAfterInspection(boolean updatedAfterInspection) {
        this.updatedAfterInspection = updatedAfterInspection;
    }

    public OffsetDateTime getDeletedAt() {
        return deletedAt;
    }

    public void setDeletedAt(OffsetDateTime deletedAt) {
        this.deletedAt = deletedAt;
    }
}

package com.dormmate.backend.modules.fridge.domain;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import com.dormmate.backend.global.jpa.AbstractTimestampedEntity;
import com.dormmate.backend.modules.auth.domain.DormUser;

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
@Table(name = "fridge_bundle")
public class FridgeBundle extends AbstractTimestampedEntity {

    @Id
    @UuidGenerator
    @Column(name = "id", nullable = false, updatable = false, columnDefinition = "uuid")
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "owner_user_id", nullable = false)
    private DormUser owner;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "fridge_compartment_id", nullable = false)
    private FridgeCompartment fridgeCompartment;

    @Column(name = "label_number", nullable = false)
    private int labelNumber;

    @Column(name = "bundle_name", nullable = false, length = 120)
    private String bundleName;

    @Column(name = "memo")
    private String memo;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 16)
    private FridgeBundleStatus status = FridgeBundleStatus.ACTIVE;

    @Column(name = "deleted_at")
    private OffsetDateTime deletedAt;

    @OneToMany(mappedBy = "bundle", cascade = CascadeType.ALL, fetch = FetchType.LAZY, orphanRemoval = true)
    private List<FridgeItem> items = new ArrayList<>();

    public UUID getId() {
        return id;
    }

    public DormUser getOwner() {
        return owner;
    }

    public void setOwner(DormUser owner) {
        this.owner = owner;
    }

    public FridgeCompartment getFridgeCompartment() {
        return fridgeCompartment;
    }

    public void setFridgeCompartment(FridgeCompartment fridgeCompartment) {
        this.fridgeCompartment = fridgeCompartment;
    }

    public int getLabelNumber() {
        return labelNumber;
    }

    public void setLabelNumber(int labelNumber) {
        this.labelNumber = labelNumber;
    }

    public String getBundleName() {
        return bundleName;
    }

    public void setBundleName(String bundleName) {
        this.bundleName = bundleName;
    }

    public String getMemo() {
        return memo;
    }

    public void setMemo(String memo) {
        this.memo = memo;
    }

    public FridgeBundleStatus getStatus() {
        return status;
    }

    public void setStatus(FridgeBundleStatus status) {
        this.status = status;
    }

    public OffsetDateTime getDeletedAt() {
        return deletedAt;
    }

    public void setDeletedAt(OffsetDateTime deletedAt) {
        this.deletedAt = deletedAt;
    }

    public List<FridgeItem> getItems() {
        return items;
    }

    public boolean isActive() {
        return status.isActive() && deletedAt == null;
    }
}

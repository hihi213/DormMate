package com.dormmate.backend.modules.fridge.domain;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import com.dormmate.backend.global.common.ResourceStatus;
import com.dormmate.backend.global.jpa.AbstractTimestampedEntity;

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
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;

import org.hibernate.annotations.UuidGenerator;

@Entity
@Table(name = "fridge_compartment")
public class FridgeCompartment extends AbstractTimestampedEntity {

    @Id
    @UuidGenerator
    @Column(name = "id", nullable = false, updatable = false, columnDefinition = "uuid")
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "fridge_unit_id", nullable = false)
    private FridgeUnit fridgeUnit;

    @Column(name = "slot_index", nullable = false)
    private int slotIndex;

    @Enumerated(EnumType.STRING)
    @Column(name = "compartment_type", nullable = false, length = 16)
    private CompartmentType compartmentType;

    @Column(name = "max_bundle_count", nullable = false)
    private int maxBundleCount;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 16)
    private ResourceStatus status = ResourceStatus.ACTIVE;

    @Column(name = "is_locked", nullable = false)
    private boolean locked;

    @Column(name = "locked_until")
    private OffsetDateTime lockedUntil;

    @OneToMany(mappedBy = "fridgeCompartment", cascade = CascadeType.ALL, fetch = FetchType.LAZY, orphanRemoval = false)
    private List<CompartmentRoomAccess> roomAccesses = new ArrayList<>();

    @OneToMany(mappedBy = "fridgeCompartment", cascade = CascadeType.ALL, fetch = FetchType.LAZY, orphanRemoval = false)
    private List<FridgeBundle> bundles = new ArrayList<>();

    @OneToOne(mappedBy = "fridgeCompartment", cascade = CascadeType.ALL, fetch = FetchType.LAZY, orphanRemoval = true)
    private BundleLabelSequence labelSequence;

    public UUID getId() {
        return id;
    }

    public FridgeUnit getFridgeUnit() {
        return fridgeUnit;
    }

    public void setFridgeUnit(FridgeUnit fridgeUnit) {
        this.fridgeUnit = fridgeUnit;
    }

    public int getSlotIndex() {
        return slotIndex;
    }

    public void setSlotIndex(int slotIndex) {
        this.slotIndex = slotIndex;
    }

    public CompartmentType getCompartmentType() {
        return compartmentType;
    }

    public void setCompartmentType(CompartmentType compartmentType) {
        this.compartmentType = compartmentType;
    }

    public int getMaxBundleCount() {
        return maxBundleCount;
    }

    public void setMaxBundleCount(int maxBundleCount) {
        this.maxBundleCount = maxBundleCount;
    }

    public ResourceStatus getStatus() {
        return status;
    }

    public void setStatus(ResourceStatus status) {
        this.status = status;
    }

    public boolean isLocked() {
        return locked;
    }

    public void setLocked(boolean locked) {
        this.locked = locked;
    }

    public OffsetDateTime getLockedUntil() {
        return lockedUntil;
    }

    public void setLockedUntil(OffsetDateTime lockedUntil) {
        this.lockedUntil = lockedUntil;
    }

    public List<CompartmentRoomAccess> getRoomAccesses() {
        return roomAccesses;
    }

    public List<FridgeBundle> getBundles() {
        return bundles;
    }

    public BundleLabelSequence getLabelSequence() {
        return labelSequence;
    }

    public void setLabelSequence(BundleLabelSequence labelSequence) {
        this.labelSequence = labelSequence;
    }

    public boolean isResourceActive() {
        return status.isActive();
    }
}

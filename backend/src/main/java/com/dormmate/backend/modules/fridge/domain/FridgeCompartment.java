package com.dormmate.backend.modules.fridge.domain;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

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

    @Column(name = "slot_code", nullable = false, unique = true, length = 24)
    private String slotCode;

    @Column(name = "display_order", nullable = false)
    private short displayOrder;

    @Enumerated(EnumType.STRING)
    @Column(name = "compartment_type", nullable = false, length = 16)
    private CompartmentType compartmentType;

    @Column(name = "max_bundle_count", nullable = false)
    private short maxBundleCount;

    @Column(name = "label_range_start", nullable = false)
    private short labelRangeStart;

    @Column(name = "label_range_end", nullable = false)
    private short labelRangeEnd;

    @Column(name = "is_active", nullable = false)
    private boolean active = true;

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

    public String getSlotCode() {
        return slotCode;
    }

    public void setSlotCode(String slotCode) {
        this.slotCode = slotCode;
    }

    public short getDisplayOrder() {
        return displayOrder;
    }

    public void setDisplayOrder(short displayOrder) {
        this.displayOrder = displayOrder;
    }

    public CompartmentType getCompartmentType() {
        return compartmentType;
    }

    public void setCompartmentType(CompartmentType compartmentType) {
        this.compartmentType = compartmentType;
    }

    public short getMaxBundleCount() {
        return maxBundleCount;
    }

    public void setMaxBundleCount(short maxBundleCount) {
        this.maxBundleCount = maxBundleCount;
    }

    public short getLabelRangeStart() {
        return labelRangeStart;
    }

    public void setLabelRangeStart(short labelRangeStart) {
        this.labelRangeStart = labelRangeStart;
    }

    public short getLabelRangeEnd() {
        return labelRangeEnd;
    }

    public void setLabelRangeEnd(short labelRangeEnd) {
        this.labelRangeEnd = labelRangeEnd;
    }

    public boolean isActive() {
        return active;
    }

    public void setActive(boolean active) {
        this.active = active;
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
}

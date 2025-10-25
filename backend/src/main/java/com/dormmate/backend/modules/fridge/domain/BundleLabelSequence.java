package com.dormmate.backend.modules.fridge.domain;

import java.util.UUID;

import com.dormmate.backend.global.jpa.AbstractTimestampedEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.MapsId;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;

@Entity
@Table(name = "bundle_label_sequence")
public class BundleLabelSequence extends AbstractTimestampedEntity {

    @Id
    @Column(name = "fridge_compartment_id", nullable = false, columnDefinition = "uuid")
    private UUID fridgeCompartmentId;

    @OneToOne(fetch = FetchType.LAZY)
    @MapsId
    @JoinColumn(name = "fridge_compartment_id")
    private FridgeCompartment fridgeCompartment;

    @Column(name = "next_label", nullable = false)
    private short nextLabel;

    public UUID getFridgeCompartmentId() {
        return fridgeCompartmentId;
    }

    public FridgeCompartment getFridgeCompartment() {
        return fridgeCompartment;
    }

    public void setFridgeCompartment(FridgeCompartment fridgeCompartment) {
        this.fridgeCompartment = fridgeCompartment;
    }

    public short getNextLabel() {
        return nextLabel;
    }

    public void setNextLabel(short nextLabel) {
        this.nextLabel = nextLabel;
    }
}

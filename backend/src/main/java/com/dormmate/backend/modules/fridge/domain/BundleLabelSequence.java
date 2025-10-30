package com.dormmate.backend.modules.fridge.domain;

import java.util.ArrayList;
import java.util.List;
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

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

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

    @Column(name = "next_number", nullable = false)
    private int nextNumber;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "recycled_numbers", nullable = false, columnDefinition = "jsonb")
    private List<Integer> recycledNumbers = new ArrayList<>();

    public UUID getFridgeCompartmentId() {
        return fridgeCompartmentId;
    }

    public FridgeCompartment getFridgeCompartment() {
        return fridgeCompartment;
    }

    public void setFridgeCompartment(FridgeCompartment fridgeCompartment) {
        this.fridgeCompartment = fridgeCompartment;
    }

    public int getNextNumber() {
        return nextNumber;
    }

    public void setNextNumber(int nextNumber) {
        this.nextNumber = nextNumber;
    }

    public List<Integer> getRecycledNumbers() {
        return recycledNumbers;
    }

    public void setRecycledNumbers(List<Integer> recycledNumbers) {
        this.recycledNumbers = recycledNumbers;
    }
}

package com.dormmate.backend.modules.fridge.domain;

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
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;

import org.hibernate.annotations.UuidGenerator;

@Entity
@Table(name = "fridge_unit")
public class FridgeUnit extends AbstractTimestampedEntity {

    @Id
    @UuidGenerator
    @Column(name = "id", nullable = false, updatable = false, columnDefinition = "uuid")
    private UUID id;

    @Column(name = "floor", nullable = false)
    private short floor;

    @Column(name = "label", nullable = false, length = 20)
    private String label;

    @Enumerated(EnumType.STRING)
    @Column(name = "cold_type", nullable = false, length = 16)
    private ColdType coldType;

    @Column(name = "description", length = 255)
    private String description;

    @OneToMany(mappedBy = "fridgeUnit", cascade = CascadeType.ALL, fetch = FetchType.LAZY, orphanRemoval = false)
    private List<FridgeCompartment> compartments = new ArrayList<>();

    public UUID getId() {
        return id;
    }

    public short getFloor() {
        return floor;
    }

    public void setFloor(short floor) {
        this.floor = floor;
    }

    public String getLabel() {
        return label;
    }

    public void setLabel(String label) {
        this.label = label;
    }

    public ColdType getColdType() {
        return coldType;
    }

    public void setColdType(ColdType coldType) {
        this.coldType = coldType;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public List<FridgeCompartment> getCompartments() {
        return compartments;
    }
}

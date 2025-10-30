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

    @Column(name = "floor_no", nullable = false)
    private short floorNo;

    @Column(name = "display_name", length = 50)
    private String displayName;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 16)
    private ResourceStatus status = ResourceStatus.ACTIVE;

    @Column(name = "retired_at")
    private OffsetDateTime retiredAt;

    @OneToMany(mappedBy = "fridgeUnit", cascade = CascadeType.ALL, fetch = FetchType.LAZY, orphanRemoval = false)
    private List<FridgeCompartment> compartments = new ArrayList<>();

    public UUID getId() {
        return id;
    }

    public short getFloorNo() {
        return floorNo;
    }

    public void setFloorNo(short floorNo) {
        this.floorNo = floorNo;
    }

    public String getDisplayName() {
        return displayName;
    }

    public void setDisplayName(String displayName) {
        this.displayName = displayName;
    }

    public ResourceStatus getStatus() {
        return status;
    }

    public void setStatus(ResourceStatus status) {
        this.status = status;
    }

    public OffsetDateTime getRetiredAt() {
        return retiredAt;
    }

    public void setRetiredAt(OffsetDateTime retiredAt) {
        this.retiredAt = retiredAt;
    }

    public List<FridgeCompartment> getCompartments() {
        return compartments;
    }
}

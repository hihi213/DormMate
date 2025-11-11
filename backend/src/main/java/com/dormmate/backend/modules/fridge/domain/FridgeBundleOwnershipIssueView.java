package com.dormmate.backend.modules.fridge.domain;

import java.time.OffsetDateTime;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import org.hibernate.annotations.Immutable;

/**
 * vw_fridge_bundle_owner_mismatch를 매핑한 읽기 전용 뷰 엔티티.
 */
@Entity
@Immutable
@Table(name = "vw_fridge_bundle_owner_mismatch")
public class FridgeBundleOwnershipIssueView {

    @Id
    @Column(name = "bundle_id", nullable = false, columnDefinition = "uuid")
    private UUID bundleId;

    @Column(name = "bundle_name", nullable = false)
    private String bundleName;

    @Column(name = "label_number", nullable = false)
    private Integer labelNumber;

    @Column(name = "owner_user_id", nullable = false, columnDefinition = "uuid")
    private UUID ownerUserId;

    @Column(name = "owner_name")
    private String ownerName;

    @Column(name = "owner_login_id")
    private String ownerLoginId;

    @Column(name = "room_id", columnDefinition = "uuid")
    private UUID roomId;

    @Column(name = "room_number")
    private String roomNumber;

    @Column(name = "room_floor")
    private Short roomFloor;

    @Column(name = "personal_no")
    private Short personalNo;

    @Column(name = "fridge_compartment_id", nullable = false, columnDefinition = "uuid")
    private UUID fridgeCompartmentId;

    @Column(name = "slot_index", nullable = false)
    private Integer slotIndex;

    @Enumerated(EnumType.STRING)
    @Column(name = "compartment_type", nullable = false, length = 16)
    private CompartmentType compartmentType;

    @Column(name = "fridge_floor_no")
    private Short fridgeFloorNo;

    @Column(name = "fridge_display_name")
    private String fridgeDisplayName;

    @Column(name = "issue_type", nullable = false, length = 64)
    private String issueType;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    public UUID getBundleId() {
        return bundleId;
    }

    public String getBundleName() {
        return bundleName;
    }

    public Integer getLabelNumber() {
        return labelNumber;
    }

    public UUID getOwnerUserId() {
        return ownerUserId;
    }

    public String getOwnerName() {
        return ownerName;
    }

    public String getOwnerLoginId() {
        return ownerLoginId;
    }

    public UUID getRoomId() {
        return roomId;
    }

    public String getRoomNumber() {
        return roomNumber;
    }

    public Short getRoomFloor() {
        return roomFloor;
    }

    public Short getPersonalNo() {
        return personalNo;
    }

    public UUID getFridgeCompartmentId() {
        return fridgeCompartmentId;
    }

    public Integer getSlotIndex() {
        return slotIndex;
    }

    public CompartmentType getCompartmentType() {
        return compartmentType;
    }

    public Short getFridgeFloorNo() {
        return fridgeFloorNo;
    }

    public String getFridgeDisplayName() {
        return fridgeDisplayName;
    }

    public String getIssueType() {
        return issueType;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }

    public OffsetDateTime getUpdatedAt() {
        return updatedAt;
    }
}

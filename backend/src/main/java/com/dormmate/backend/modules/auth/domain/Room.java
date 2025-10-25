package com.dormmate.backend.modules.auth.domain;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import com.dormmate.backend.global.jpa.AbstractTimestampedEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;

import org.hibernate.annotations.UuidGenerator;

/**
 * 기숙사 호실 메타데이터 엔터티.
 */
@Entity
@Table(name = "room")
public class Room extends AbstractTimestampedEntity {

    @Id
    @UuidGenerator
    @Column(name = "id", nullable = false, updatable = false, columnDefinition = "uuid")
    private UUID id;

    @Column(name = "floor", nullable = false)
    private short floor;

    @Column(name = "room_number", nullable = false, length = 4)
    private String roomNumber;

    @Enumerated(EnumType.STRING)
    @Column(name = "room_type", nullable = false, length = 16)
    private RoomType roomType;

    @Column(name = "capacity", nullable = false)
    private short capacity;

    @OneToMany(mappedBy = "room")
    private List<RoomAssignment> assignments = new ArrayList<>();

    @OneToMany(mappedBy = "room")
    private List<SignupRequest> signupRequests = new ArrayList<>();

    public UUID getId() {
        return id;
    }

    public short getFloor() {
        return floor;
    }

    public void setFloor(short floor) {
        this.floor = floor;
    }

    public String getRoomNumber() {
        return roomNumber;
    }

    public void setRoomNumber(String roomNumber) {
        this.roomNumber = roomNumber;
    }

    public RoomType getRoomType() {
        return roomType;
    }

    public void setRoomType(RoomType roomType) {
        this.roomType = roomType;
    }

    public short getCapacity() {
        return capacity;
    }

    public void setCapacity(short capacity) {
        this.capacity = capacity;
    }

    public List<RoomAssignment> getAssignments() {
        return assignments;
    }

    public List<SignupRequest> getSignupRequests() {
        return signupRequests;
    }

    public String getDisplayName() {
        return floor + "F " + roomNumber;
    }
}

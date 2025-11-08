package com.dormmate.backend.modules.auth.application;

import java.util.Objects;
import java.util.UUID;

import com.dormmate.backend.global.security.SecurityUtils;
import com.dormmate.backend.modules.auth.domain.Room;
import com.dormmate.backend.modules.auth.domain.RoomAssignment;

/**
 * Shared helpers for working with {@link RoomAssignment}.
 */
public final class RoomAssignmentSupport {

    private RoomAssignmentSupport() {
    }

    public static Room requireRoom(RoomAssignment assignment) {
        return Objects.requireNonNull(assignment.getRoom(), "room assignment missing room");
    }

    public static UUID requireRoomId(RoomAssignment assignment) {
        Room room = requireRoom(assignment);
        return Objects.requireNonNull(room.getId(), "room id missing");
    }

    public static boolean isFloorManagerOnFloor(RoomAssignment assignment, short targetFloor) {
        return SecurityUtils.hasRole("FLOOR_MANAGER") && requireRoom(assignment).getFloor() == targetFloor;
    }
}

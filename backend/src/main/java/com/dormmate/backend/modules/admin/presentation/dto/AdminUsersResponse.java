package com.dormmate.backend.modules.admin.presentation.dto;

import java.util.List;

public record AdminUsersResponse(
        List<User> items,
        int page,
        int size,
        long totalElements,
        int totalPages,
        List<Integer> availableFloors
) {

    public record User(
            String id,
            String name,
            String room,
            Integer floor,
            String roomCode,
            Short personalNo,
            String role,
            List<String> roles,
            String status,
            String lastLogin,
            int penalties
    ) {
    }
}

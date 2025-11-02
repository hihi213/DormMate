package com.dormmate.backend.modules.admin.presentation.dto;

import java.util.List;

public record AdminUsersResponse(List<User> items) {

    public record User(
            String id,
            String name,
            String room,
            String role,
            List<String> roles,
            String status,
            String lastLogin,
            int inspectionsInProgress,
            int penalties
    ) {
    }
}

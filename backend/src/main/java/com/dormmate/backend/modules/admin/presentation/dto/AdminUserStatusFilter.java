package com.dormmate.backend.modules.admin.presentation.dto;

import java.util.Locale;

import com.dormmate.backend.modules.auth.domain.DormUserStatus;

public enum AdminUserStatusFilter {
    ACTIVE(DormUserStatus.ACTIVE),
    INACTIVE(DormUserStatus.INACTIVE),
    ALL(null);

    private final DormUserStatus mappedStatus;

    AdminUserStatusFilter(DormUserStatus mappedStatus) {
        this.mappedStatus = mappedStatus;
    }

    public DormUserStatus toDormUserStatus() {
        return mappedStatus;
    }

    public static AdminUserStatusFilter from(String raw) {
        if (raw == null || raw.isBlank()) {
            return ACTIVE;
        }
        String normalized = raw.trim().toUpperCase(Locale.ROOT);
        for (AdminUserStatusFilter value : values()) {
            if (value.name().equals(normalized)) {
                return value;
            }
        }
        throw new IllegalArgumentException("Unsupported status filter: " + raw);
    }
}

package com.dormmate.backend.global.common;

public enum ResourceStatus {
    ACTIVE,
    SUSPENDED,
    REPORTED,
    RETIRED;

    public boolean isActive() {
        return this == ACTIVE;
    }
}

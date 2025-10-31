package com.dormmate.backend.modules.fridge.domain;

public enum FridgeBundleStatus {
    ACTIVE,
    DELETED;

    public boolean isActive() {
        return this == ACTIVE;
    }
}

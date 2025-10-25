package com.dormmate.backend.modules.fridge.domain;

public enum FridgeBundleStatus {
    ACTIVE,
    REMOVED;

    public boolean isActive() {
        return this == ACTIVE;
    }
}

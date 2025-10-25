package com.dormmate.backend.modules.fridge.domain;

public enum FridgeItemStatus {
    ACTIVE,
    REMOVED;

    public boolean isActive() {
        return this == ACTIVE;
    }
}

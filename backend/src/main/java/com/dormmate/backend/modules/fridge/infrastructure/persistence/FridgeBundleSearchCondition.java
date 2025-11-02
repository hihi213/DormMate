package com.dormmate.backend.modules.fridge.infrastructure.persistence;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import com.dormmate.backend.modules.fridge.domain.FridgeBundleStatus;

public record FridgeBundleSearchCondition(
        UUID compartmentId,
        UUID ownerId,
        Set<FridgeBundleStatus> statuses,
        String keyword,
        Integer exactSlotIndex,
        Integer exactLabelNumber,
        boolean searchItems,
        List<Integer> slotLetterIndices,
        OffsetDateTime deletedSince,
        FridgeBundleSearchOrder order
) {

    public FridgeBundleSearchCondition {
        statuses = statuses == null ? Set.of() : Set.copyOf(statuses);
        slotLetterIndices = slotLetterIndices == null ? List.of() : List.copyOf(slotLetterIndices);
    }
}

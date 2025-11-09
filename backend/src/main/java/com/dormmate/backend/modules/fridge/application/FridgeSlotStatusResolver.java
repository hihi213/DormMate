package com.dormmate.backend.modules.fridge.application;

import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.Collection;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import org.springframework.stereotype.Component;

import com.dormmate.backend.modules.fridge.domain.FridgeCompartment;
import com.dormmate.backend.modules.fridge.presentation.dto.FridgeSlotStatus;
import com.dormmate.backend.modules.inspection.domain.InspectionStatus;
import com.dormmate.backend.modules.inspection.infrastructure.persistence.InspectionSessionRepository;

@Component
public class FridgeSlotStatusResolver {

    private final InspectionSessionRepository inspectionSessionRepository;
    private final Clock clock;

    public FridgeSlotStatusResolver(
            InspectionSessionRepository inspectionSessionRepository,
            Clock clock
    ) {
        this.inspectionSessionRepository = inspectionSessionRepository;
        this.clock = clock;
    }

    public Map<UUID, FridgeSlotStatus> resolve(Collection<FridgeCompartment> compartments) {
        if (compartments == null || compartments.isEmpty()) {
            return Collections.emptyMap();
        }
        Set<UUID> compartmentIds = compartments.stream()
                .map(FridgeCompartment::getId)
                .collect(Collectors.toSet());
        if (compartmentIds.isEmpty()) {
            return Collections.emptyMap();
        }

        Set<UUID> compartmentsUnderInspection = inspectionSessionRepository
                .findByFridgeCompartmentIdInAndStatus(compartmentIds, InspectionStatus.IN_PROGRESS)
                .stream()
                .map(session -> session.getFridgeCompartment().getId())
                .collect(Collectors.toCollection(HashSet::new));

        OffsetDateTime now = OffsetDateTime.now(clock);

        Map<UUID, FridgeSlotStatus> resolved = new HashMap<>();
        for (FridgeCompartment compartment : compartments) {
            resolved.put(compartment.getId(), determineStatus(compartment, compartmentsUnderInspection, now));
        }

        return resolved;
    }

    public FridgeSlotStatus resolve(FridgeCompartment compartment) {
        if (compartment == null) {
            return FridgeSlotStatus.ACTIVE;
        }
        return resolve(List.of(compartment)).getOrDefault(compartment.getId(), FridgeSlotStatus.ACTIVE);
    }

    private FridgeSlotStatus determineStatus(
            FridgeCompartment compartment,
            Set<UUID> compartmentsUnderInspection,
            OffsetDateTime now
    ) {
        if (compartmentsUnderInspection.contains(compartment.getId())) {
            return FridgeSlotStatus.IN_INSPECTION;
        }
        if (isLockActive(compartment, now)) {
            return FridgeSlotStatus.LOCKED;
        }
        return FridgeSlotStatus.ACTIVE;
    }

    private boolean isLockActive(FridgeCompartment compartment, OffsetDateTime now) {
        OffsetDateTime lockedUntil = compartment.getLockedUntil();
        if (lockedUntil != null && lockedUntil.isBefore(now)) {
            return false;
        }

        if (compartment.isLocked()) {
            if (lockedUntil == null || lockedUntil.isAfter(now)) {
                return true;
            }
        }

        return lockedUntil != null && lockedUntil.isAfter(now);
    }
}


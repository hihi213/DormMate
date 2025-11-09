package com.dormmate.backend.modules.fridge.application;

import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

import com.dormmate.backend.global.common.ResourceStatus;
import com.dormmate.backend.global.security.SecurityUtils;
import com.dormmate.backend.modules.fridge.domain.FridgeBundleStatus;
import com.dormmate.backend.modules.fridge.domain.FridgeCompartment;
import com.dormmate.backend.modules.fridge.infrastructure.persistence.FridgeCompartmentRepository;
import com.dormmate.backend.modules.fridge.presentation.dto.FridgeDtoMapper;
import com.dormmate.backend.modules.fridge.presentation.dto.FridgeSlotResponse;
import com.dormmate.backend.modules.fridge.presentation.dto.FridgeSlotStatus;
import com.dormmate.backend.modules.fridge.presentation.dto.UpdateCompartmentConfigRequest;
import com.dormmate.backend.modules.inspection.domain.InspectionStatus;
import com.dormmate.backend.modules.inspection.infrastructure.persistence.InspectionSessionRepository;

@Service
@Transactional
public class FridgeAdminService {

    private final FridgeCompartmentRepository fridgeCompartmentRepository;
    private final InspectionSessionRepository inspectionSessionRepository;
    private final FridgeSlotStatusResolver fridgeSlotStatusResolver;

    public FridgeAdminService(
            FridgeCompartmentRepository fridgeCompartmentRepository,
            InspectionSessionRepository inspectionSessionRepository,
            FridgeSlotStatusResolver fridgeSlotStatusResolver
    ) {
        this.fridgeCompartmentRepository = fridgeCompartmentRepository;
        this.inspectionSessionRepository = inspectionSessionRepository;
        this.fridgeSlotStatusResolver = fridgeSlotStatusResolver;
    }

    @Transactional(readOnly = true)
    public List<FridgeSlotResponse> listCompartments(Integer floorParam, String viewParam) {
        ensureAdminRole();

        boolean fullView = "full".equalsIgnoreCase(viewParam) || "detailed".equalsIgnoreCase(viewParam);

        List<FridgeCompartment> compartments;
        if (floorParam != null) {
            if (floorParam < 2 || floorParam > 5) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "INVALID_FLOOR");
            }
            short floor = floorParam.shortValue();
            compartments = fridgeCompartmentRepository.findByFloorWithAccesses(floor);
        } else {
            compartments = fridgeCompartmentRepository.findAllWithActiveUnit();
        }

        Map<UUID, FridgeSlotStatus> slotStatuses = fridgeSlotStatusResolver.resolve(compartments);

        return compartments.stream()
                .sorted(Comparator
                        .comparingInt((FridgeCompartment compartment) -> compartment.getFridgeUnit().getFloorNo())
                        .thenComparingInt(FridgeCompartment::getSlotIndex))
                .map(compartment -> FridgeDtoMapper.toSlotResponse(
                        compartment,
                        fullView,
                        slotStatuses.getOrDefault(compartment.getId(), FridgeSlotStatus.ACTIVE)))
                .toList();
    }

    public FridgeSlotResponse updateCompartment(@NonNull UUID compartmentId,
                                                @NonNull UpdateCompartmentConfigRequest request) {
        ensureAdminRole();

        FridgeCompartment compartment = fridgeCompartmentRepository.findById(compartmentId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "SLOT_NOT_FOUND"));

        applyCapacityUpdate(request, compartment);
        applyStatusUpdate(request, compartment);

        FridgeCompartment saved = fridgeCompartmentRepository.save(compartment);
        fridgeCompartmentRepository.flush();

        FridgeSlotStatus slotStatus = fridgeSlotStatusResolver.resolve(saved);

        return FridgeDtoMapper.toSlotResponse(saved, true, slotStatus);
    }

    private void applyCapacityUpdate(UpdateCompartmentConfigRequest request, FridgeCompartment compartment) {
        Integer capacity = request.maxBundleCount();
        if (capacity == null) {
            return;
        }

        if (capacity <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "INVALID_CAPACITY");
        }

        long activeBundleCount = compartment.getBundles().stream()
                .filter(bundle -> bundle.getStatus() == FridgeBundleStatus.ACTIVE)
                .count();
        if (activeBundleCount > capacity) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "CAPACITY_BELOW_ACTIVE");
        }

        compartment.setMaxBundleCount(capacity);
    }

    private void applyStatusUpdate(UpdateCompartmentConfigRequest request, FridgeCompartment compartment) {
        String statusRaw = request.status();
        if (!StringUtils.hasText(statusRaw)) {
            return;
        }

        ResourceStatus newStatus;
        try {
            newStatus = ResourceStatus.valueOf(statusRaw.trim().toUpperCase());
        } catch (IllegalArgumentException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "INVALID_STATUS");
        }

        if (newStatus == compartment.getStatus()) {
            return;
        }

        if (requiresSessionCheck(newStatus)) {
            boolean activeSessionExists = inspectionSessionRepository
                    .findByFridgeCompartmentAndStatus(compartment, InspectionStatus.IN_PROGRESS)
                    .stream()
                    .findAny()
                    .isPresent();
            if (activeSessionExists) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "COMPARTMENT_HAS_ACTIVE_SESSION");
            }
        }

        if (!newStatus.isActive()) {
            compartment.setLocked(false);
            compartment.setLockedUntil(null);
        }

        compartment.setStatus(newStatus);
    }

    private boolean requiresSessionCheck(ResourceStatus newStatus) {
        return newStatus == ResourceStatus.SUSPENDED
                || newStatus == ResourceStatus.REPORTED
                || newStatus == ResourceStatus.RETIRED;
    }

    private void ensureAdminRole() {
        if (!SecurityUtils.hasRole("ADMIN")) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "ADMIN_ONLY");
        }
    }
}

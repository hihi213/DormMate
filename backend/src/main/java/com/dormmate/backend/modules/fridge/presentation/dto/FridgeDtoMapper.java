package com.dormmate.backend.modules.fridge.presentation.dto;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

import com.dormmate.backend.modules.auth.domain.RoomAssignment;
import com.dormmate.backend.modules.fridge.domain.FridgeBundle;
import com.dormmate.backend.modules.fridge.domain.FridgeCompartment;
import com.dormmate.backend.modules.fridge.domain.FridgeItem;
import com.dormmate.backend.modules.fridge.domain.FridgeItemStatus;
import com.dormmate.backend.modules.fridge.domain.LabelFormatter;

public final class FridgeDtoMapper {

    private static final int EXPIRING_THRESHOLD_DAYS = 3;

    private FridgeDtoMapper() {
    }

    public record BundleInspectionSummary(
            UUID lastInspectionId,
            OffsetDateTime lastInspectionAt,
            int warningCount,
            int disposalCount,
            String alertState
    ) {
    }

    public static FridgeSlotResponse toSlotResponse(FridgeCompartment compartment, boolean includeCapacity) {
        int slotIndex = compartment.getSlotIndex();
        String slotLetter = LabelFormatter.toSlotLetter(slotIndex);
        int floorNo = compartment.getFridgeUnit().getFloorNo();
        String floorCode = floorNo + "F";

        Integer capacity = includeCapacity ? compartment.getMaxBundleCount() : null;
        String displayName = includeCapacity ? buildDisplayName(compartment, floorNo) : null;
        Integer occupiedCount = null;
        if (includeCapacity) {
            occupiedCount = (int) compartment.getBundles().stream()
                    .filter(bundle -> bundle.getStatus() != null && bundle.getStatus().isActive())
                    .count();
        }

        return new FridgeSlotResponse(
                compartment.getId(),
                slotIndex,
                slotLetter,
                floorNo,
                floorCode,
                compartment.getCompartmentType().name(),
                compartment.getStatus().name(),
                compartment.isLocked(),
                compartment.getLockedUntil(),
                capacity,
                displayName,
                occupiedCount
        );
    }

    public static FridgeBundleSummaryResponse toSummary(FridgeBundle bundle, RoomAssignment assignment) {
        return toSummary(bundle, assignment, true, null);
    }

    public static FridgeBundleSummaryResponse toSummary(
            FridgeBundle bundle,
            RoomAssignment assignment,
            boolean includeMemo
    ) {
        return toSummary(bundle, assignment, includeMemo, null);
    }

    public static FridgeBundleSummaryResponse toSummary(
            FridgeBundle bundle,
            RoomAssignment assignment,
            boolean includeMemo,
            BundleInspectionSummary inspectionSummary
    ) {
        FridgeCompartment compartment = bundle.getFridgeCompartment();
        int slotIndex = compartment.getSlotIndex();
        String slotLabel = LabelFormatter.toSlotLetter(slotIndex);
        int labelNumber = bundle.getLabelNumber();
        String labelDisplay = LabelFormatter.toBundleLabel(slotIndex, labelNumber);
        int activeItemCount = (int) bundle.getItems().stream()
                .filter(item -> item.getStatus() == FridgeItemStatus.ACTIVE)
                .count();
        Long version = computeVersion(bundle);
        return new FridgeBundleSummaryResponse(
                bundle.getId(),
                bundle.getId(),
                compartment.getId(),
                slotIndex,
                slotLabel,
                labelNumber,
                labelDisplay,
                bundle.getBundleName(),
                includeMemo ? bundle.getMemo() : null,
                bundle.getOwner().getId(),
                bundle.getOwner().getFullName(),
                assignment != null ? assignment.getRoom().getDisplayName() : null,
                bundle.getStatus().name(),
                computeBundleFreshness(bundle),
                activeItemCount,
                bundle.getCreatedAt(),
                bundle.getUpdatedAt(),
                bundle.getDeletedAt(),
                version,
                inspectionSummary != null ? inspectionSummary.lastInspectionId() : null,
                inspectionSummary != null ? inspectionSummary.lastInspectionAt() : null,
                inspectionSummary != null ? inspectionSummary.warningCount() : null,
                inspectionSummary != null ? inspectionSummary.disposalCount() : null,
                inspectionSummary != null ? inspectionSummary.alertState() : null
        );
    }

    public static FridgeBundleResponse toResponse(FridgeBundle bundle, RoomAssignment assignment) {
        return toResponse(bundle, assignment, true);
    }

    public static FridgeBundleResponse toResponse(
            FridgeBundle bundle,
            RoomAssignment assignment,
            boolean includeMemo
    ) {
        FridgeCompartment compartment = bundle.getFridgeCompartment();
        int slotIndex = compartment.getSlotIndex();
        String slotLabel = LabelFormatter.toSlotLetter(slotIndex);
        int labelNumber = bundle.getLabelNumber();
        String labelDisplay = LabelFormatter.toBundleLabel(slotIndex, labelNumber);
        List<FridgeItemResponse> items = bundle.getItems().stream()
                .sorted(Comparator.comparing(FridgeItem::getCreatedAt))
                .map(FridgeDtoMapper::toItemResponse)
                .toList();
        int activeItemCount = (int) bundle.getItems().stream()
                .filter(item -> item.getStatus() == FridgeItemStatus.ACTIVE)
                .count();
        Long version = computeVersion(bundle);
        return new FridgeBundleResponse(
                bundle.getId(),
                bundle.getId(),
                compartment.getId(),
                slotIndex,
                slotLabel,
                labelNumber,
                labelDisplay,
                bundle.getBundleName(),
                includeMemo ? bundle.getMemo() : null,
                bundle.getOwner().getId(),
                bundle.getOwner().getFullName(),
                assignment != null ? assignment.getRoom().getDisplayName() : null,
                bundle.getStatus().name(),
                computeBundleFreshness(bundle),
                activeItemCount,
                bundle.getCreatedAt(),
                bundle.getUpdatedAt(),
                bundle.getDeletedAt(),
                version,
                items
        );
    }

    public static FridgeItemResponse toItemResponse(FridgeItem item) {
        OffsetDateTime lastInspectedAt = item.getLastInspectedAt();
        boolean updatedAfterInspection = lastInspectedAt != null
                && item.getUpdatedAt() != null
                && item.getUpdatedAt().isAfter(lastInspectedAt);

        return new FridgeItemResponse(
                item.getId(),
                item.getBundle().getId(),
                item.getItemName(),
                item.getExpiryDate(),
                item.getQuantity(),
                item.getUnitCode(),
                computeItemFreshness(item),
                lastInspectedAt,
                updatedAfterInspection,
                item.getCreatedAt(),
                item.getUpdatedAt(),
                item.getDeletedAt()
        );
    }

    private static String computeBundleFreshness(FridgeBundle bundle) {
        boolean hasExpired = bundle.getItems().stream()
                .anyMatch(item -> item.getStatus() == FridgeItemStatus.ACTIVE
                        && Objects.equals(computeItemFreshness(item), "expired"));
        if (hasExpired) {
            return "expired";
        }
        boolean hasExpiring = bundle.getItems().stream()
                .anyMatch(item -> item.getStatus() == FridgeItemStatus.ACTIVE
                        && Objects.equals(computeItemFreshness(item), "expiring"));
        if (hasExpiring) {
            return "expiring";
        }
        return "ok";
    }

    private static String computeItemFreshness(FridgeItem item) {
        if (item.getStatus() != FridgeItemStatus.ACTIVE) {
            return "expired";
        }
        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        if (item.getExpiryDate().isBefore(today)) {
            return "expired";
        }
        if (!item.getExpiryDate().isAfter(today.plusDays(EXPIRING_THRESHOLD_DAYS))) {
            return "expiring";
        }
        return "ok";
    }

    private static String buildDisplayName(FridgeCompartment compartment, int floorNo) {
        String typeLabel = compartment.getCompartmentType() == com.dormmate.backend.modules.fridge.domain.CompartmentType.FREEZE
                ? "냉동"
                : "냉장";
        return floorNo + "F " + typeLabel + " " + (compartment.getSlotIndex() + 1) + "칸";
    }

    private static Long computeVersion(FridgeBundle bundle) {
        OffsetDateTime source = bundle.getUpdatedAt() != null ? bundle.getUpdatedAt() : bundle.getCreatedAt();
        return source != null ? source.toInstant().toEpochMilli() : null;
    }
}

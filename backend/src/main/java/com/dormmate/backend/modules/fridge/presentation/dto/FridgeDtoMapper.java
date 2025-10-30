package com.dormmate.backend.modules.fridge.presentation.dto;

import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;

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

    public static FridgeBundleSummaryResponse toSummary(FridgeBundle bundle, RoomAssignment assignment) {
        FridgeCompartment compartment = bundle.getFridgeCompartment();
        int slotIndex = compartment.getSlotIndex();
        String slotLabel = LabelFormatter.toSlotLetter(slotIndex);
        int labelNumber = bundle.getLabelNumber();
        String labelDisplay = LabelFormatter.toBundleLabel(slotIndex, labelNumber);
        int activeItemCount = (int) bundle.getItems().stream()
                .filter(item -> item.getStatus() == FridgeItemStatus.ACTIVE)
                .count();
        return new FridgeBundleSummaryResponse(
                bundle.getId(),
                compartment.getId(),
                slotIndex,
                slotLabel,
                labelNumber,
                labelDisplay,
                bundle.getBundleName(),
                bundle.getMemo(),
                bundle.getOwner().getId(),
                bundle.getOwner().getFullName(),
                assignment != null ? assignment.getRoom().getDisplayName() : null,
                bundle.getStatus().name(),
                computeBundleFreshness(bundle),
                activeItemCount,
                bundle.getCreatedAt(),
                bundle.getUpdatedAt(),
                bundle.getDeletedAt()
        );
    }

    public static FridgeBundleResponse toResponse(FridgeBundle bundle, RoomAssignment assignment) {
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
        return new FridgeBundleResponse(
                bundle.getId(),
                compartment.getId(),
                slotIndex,
                slotLabel,
                labelNumber,
                labelDisplay,
                bundle.getBundleName(),
                bundle.getMemo(),
                bundle.getOwner().getId(),
                bundle.getOwner().getFullName(),
                assignment != null ? assignment.getRoom().getDisplayName() : null,
                bundle.getStatus().name(),
                computeBundleFreshness(bundle),
                activeItemCount,
                bundle.getCreatedAt(),
                bundle.getUpdatedAt(),
                bundle.getDeletedAt(),
                items
        );
    }

    public static FridgeItemResponse toItemResponse(FridgeItem item) {
        return new FridgeItemResponse(
                item.getId(),
                item.getBundle().getId(),
                item.getItemName(),
                item.getExpiryDate(),
                item.getQuantity(),
                item.getUnitCode(),
                computeItemFreshness(item),
                item.isUpdatedAfterInspection(),
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
}

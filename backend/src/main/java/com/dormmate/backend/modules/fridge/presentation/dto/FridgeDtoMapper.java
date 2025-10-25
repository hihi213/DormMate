package com.dormmate.backend.modules.fridge.presentation.dto;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;

import com.dormmate.backend.modules.auth.domain.RoomAssignment;
import com.dormmate.backend.modules.fridge.domain.FridgeBundle;
import com.dormmate.backend.modules.fridge.domain.FridgeItem;
import com.dormmate.backend.modules.fridge.domain.FridgeItemStatus;

public final class FridgeDtoMapper {

    private static final int EXPIRING_THRESHOLD_DAYS = 3;

    private FridgeDtoMapper() {
    }

    public static FridgeBundleSummaryResponse toSummary(FridgeBundle bundle, RoomAssignment assignment) {
        return new FridgeBundleSummaryResponse(
                bundle.getId(),
                bundle.getFridgeCompartment().getId(),
                bundle.getFridgeCompartment().getSlotCode(),
                parseLabelNumber(bundle.getLabelCode()),
                bundle.getLabelCode(),
                bundle.getBundleName(),
                bundle.getMemo(),
                bundle.getOwner().getId(),
                bundle.getOwner().getFullName(),
                assignment != null ? assignment.getRoom().getDisplayName() : null,
                computeBundleFreshness(bundle),
                (int) bundle.getItems().stream().filter(item -> item.getStatus() == FridgeItemStatus.ACTIVE).count(),
                bundle.getCreatedAt(),
                bundle.getUpdatedAt(),
                bundle.getDeletedAt()
        );
    }

    public static FridgeBundleResponse toResponse(FridgeBundle bundle, RoomAssignment assignment) {
        List<FridgeItemResponse> items = bundle.getItems().stream()
                .sorted(Comparator.comparingInt(FridgeItem::getSequenceNo))
                .map(FridgeDtoMapper::toItemResponse)
                .toList();
        return new FridgeBundleResponse(
                bundle.getId(),
                bundle.getFridgeCompartment().getId(),
                bundle.getFridgeCompartment().getSlotCode(),
                parseLabelNumber(bundle.getLabelCode()),
                bundle.getLabelCode(),
                bundle.getBundleName(),
                bundle.getMemo(),
                bundle.getOwner().getId(),
                bundle.getOwner().getFullName(),
                assignment != null ? assignment.getRoom().getDisplayName() : null,
                computeBundleFreshness(bundle),
                (int) bundle.getItems().stream().filter(item -> item.getStatus() == FridgeItemStatus.ACTIVE).count(),
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
                item.getSequenceNo(),
                item.getItemName(),
                item.getExpiresOn(),
                item.getQuantity(),
                item.getUnit(),
                computeItemFreshness(item),
                item.getPriority() != null ? item.getPriority().name().toLowerCase() : null,
                item.getMemo(),
                item.getCreatedAt(),
                item.getUpdatedAt(),
                item.getDeletedAt()
        );
    }

    public static int parseLabelNumber(String labelCode) {
        if (labelCode == null || labelCode.isBlank()) {
            return 0;
        }
        try {
            return Integer.parseInt(labelCode);
        } catch (NumberFormatException ex) {
            return 0;
        }
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
        if (item.getExpiresOn().isBefore(today)) {
            return "expired";
        }
        if (!item.getExpiresOn().isAfter(today.plusDays(EXPIRING_THRESHOLD_DAYS))) {
            return "expiring";
        }
        return "ok";
    }
}

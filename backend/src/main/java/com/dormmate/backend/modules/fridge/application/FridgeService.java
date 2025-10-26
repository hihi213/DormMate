package com.dormmate.backend.modules.fridge.application;

import java.time.Clock;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import com.dormmate.backend.modules.fridge.presentation.dto.BundleListResponse;
import com.dormmate.backend.modules.fridge.presentation.dto.CreateBundleItemInput;
import com.dormmate.backend.modules.fridge.presentation.dto.CreateBundleRequest;
import com.dormmate.backend.modules.fridge.presentation.dto.CreateBundleResponse;
import com.dormmate.backend.modules.fridge.presentation.dto.FridgeBundleResponse;
import com.dormmate.backend.modules.fridge.presentation.dto.FridgeBundleSummaryResponse;
import com.dormmate.backend.modules.fridge.presentation.dto.FridgeDtoMapper;
import com.dormmate.backend.modules.fridge.presentation.dto.FridgeItemResponse;
import com.dormmate.backend.modules.fridge.presentation.dto.FridgeSlotResponse;
import com.dormmate.backend.modules.fridge.presentation.dto.UpdateBundleRequest;
import com.dormmate.backend.modules.fridge.presentation.dto.AddItemRequest;
import com.dormmate.backend.modules.fridge.presentation.dto.UpdateItemRequest;
import com.dormmate.backend.modules.auth.domain.DormUser;
import com.dormmate.backend.modules.auth.domain.Room;
import com.dormmate.backend.modules.auth.domain.RoomAssignment;
import com.dormmate.backend.modules.fridge.domain.BundleLabelSequence;
import com.dormmate.backend.modules.fridge.domain.CompartmentRoomAccess;
import com.dormmate.backend.modules.fridge.domain.FridgeBundle;
import com.dormmate.backend.modules.fridge.domain.FridgeBundleStatus;
import com.dormmate.backend.modules.fridge.domain.FridgeCompartment;
import com.dormmate.backend.modules.fridge.domain.FridgeItem;
import com.dormmate.backend.modules.fridge.domain.FridgeItemPriority;
import com.dormmate.backend.modules.fridge.domain.FridgeItemStatus;
import com.dormmate.backend.modules.auth.infrastructure.persistence.DormUserRepository;
import com.dormmate.backend.modules.auth.infrastructure.persistence.RoomAssignmentRepository;
import com.dormmate.backend.modules.fridge.infrastructure.persistence.BundleLabelSequenceRepository;
import com.dormmate.backend.modules.fridge.infrastructure.persistence.CompartmentRoomAccessRepository;
import com.dormmate.backend.modules.fridge.infrastructure.persistence.FridgeBundleRepository;
import com.dormmate.backend.modules.fridge.infrastructure.persistence.FridgeCompartmentRepository;
import com.dormmate.backend.modules.fridge.infrastructure.persistence.FridgeItemRepository;
import com.dormmate.backend.modules.fridge.infrastructure.persistence.FridgeUnitRepository;
import com.dormmate.backend.modules.inspection.infrastructure.persistence.InspectionSessionRepository;
import com.dormmate.backend.global.security.SecurityUtils;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

@Service
@Transactional
public class FridgeService {

    private static final int MAX_LABEL = 999;
    private final FridgeUnitRepository fridgeUnitRepository;
    private final FridgeCompartmentRepository fridgeCompartmentRepository;
    private final CompartmentRoomAccessRepository compartmentRoomAccessRepository;
    private final BundleLabelSequenceRepository bundleLabelSequenceRepository;
    private final FridgeBundleRepository fridgeBundleRepository;
    private final FridgeItemRepository fridgeItemRepository;
    private final RoomAssignmentRepository roomAssignmentRepository;
    private final DormUserRepository dormUserRepository;
    private final InspectionSessionRepository inspectionSessionRepository;
    private final Clock clock;

    public FridgeService(
            FridgeUnitRepository fridgeUnitRepository,
            FridgeCompartmentRepository fridgeCompartmentRepository,
            CompartmentRoomAccessRepository compartmentRoomAccessRepository,
            BundleLabelSequenceRepository bundleLabelSequenceRepository,
            FridgeBundleRepository fridgeBundleRepository,
            FridgeItemRepository fridgeItemRepository,
            RoomAssignmentRepository roomAssignmentRepository,
            DormUserRepository dormUserRepository,
            InspectionSessionRepository inspectionSessionRepository,
            Clock clock
    ) {
        this.fridgeUnitRepository = fridgeUnitRepository;
        this.fridgeCompartmentRepository = fridgeCompartmentRepository;
        this.compartmentRoomAccessRepository = compartmentRoomAccessRepository;
        this.bundleLabelSequenceRepository = bundleLabelSequenceRepository;
        this.fridgeBundleRepository = fridgeBundleRepository;
        this.fridgeItemRepository = fridgeItemRepository;
        this.roomAssignmentRepository = roomAssignmentRepository;
        this.dormUserRepository = dormUserRepository;
        this.inspectionSessionRepository = inspectionSessionRepository;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public List<FridgeSlotResponse> getSlots(Integer floorParam, String view) {
        int floor = floorParam != null ? floorParam : 2;
        UUID currentUserId = SecurityUtils.getCurrentUserId();
        boolean isAdmin = SecurityUtils.hasRole("ADMIN");
        boolean isManager = SecurityUtils.hasRole("FLOOR_MANAGER");

        Set<UUID> accessibleCompartmentIds = new HashSet<>();
        if (!isAdmin) {
            RoomAssignment assignment = roomAssignmentRepository.findActiveAssignment(currentUserId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN, "ROOM_ASSIGNMENT_REQUIRED"));
            if (!isManager) {
                accessibleCompartmentIds.addAll(
                        compartmentRoomAccessRepository.findByRoomIdAndReleasedAtIsNull(assignment.getRoom().getId())
                                .stream()
                                .map(access -> access.getFridgeCompartment().getId())
                                .toList());
            } else {
                // 층별장은 같은 층 전체 접근 허용
                accessibleCompartmentIds.addAll(
                        compartmentRoomAccessRepository.findByRoomIdAndReleasedAtIsNull(assignment.getRoom().getId())
                                .stream()
                                .map(access -> access.getFridgeCompartment().getId())
                                .toList());
            }
        }

        List<FridgeSlotResponse> results = new ArrayList<>();
        fridgeUnitRepository.findByFloor((short) floor).forEach(unit -> {
            List<FridgeCompartment> compartments = fridgeCompartmentRepository
                    .findByFridgeUnitOrderByDisplayOrder(unit);
            for (FridgeCompartment compartment : compartments) {
                if (!isAdmin && accessibleCompartmentIds.isEmpty() && !isManager) {
                    // 접근 가능한 칸이 없는 경우 skip
                    continue;
                }
                if (!isAdmin && !isManager && !accessibleCompartmentIds.contains(compartment.getId())) {
                    continue;
                }

                results.add(mapSlot(unit.getFloor(), compartment, "full".equalsIgnoreCase(view)));
            }
        });
        results.sort(Comparator.comparing(FridgeSlotResponse::displayOrder, Comparator.nullsLast(Integer::compareTo)));
        return results;
    }

    @Transactional(readOnly = true)
    public BundleListResponse getBundles(String slotCode, String ownerSelector, String statusSelector, String search) {
        UUID currentUserId = SecurityUtils.getCurrentUserId();
        DormUser currentUser = loadUser(currentUserId);
        boolean isAdmin = SecurityUtils.hasRole("ADMIN");
        boolean isManager = SecurityUtils.hasRole("FLOOR_MANAGER");
        boolean includeRemoved = "removed".equalsIgnoreCase(statusSelector);

        UUID ownerFilter = null;
        if ("all".equalsIgnoreCase(ownerSelector)) {
            if (!isAdmin && !isManager) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "FORBIDDEN");
            }
        } else {
            ownerFilter = currentUserId;
        }

        List<FridgeBundle> candidates = new ArrayList<>();

        if (slotCode != null && !slotCode.isBlank()) {
            FridgeCompartment compartment = fridgeCompartmentRepository.findBySlotCode(slotCode)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "SLOT_NOT_FOUND"));
            verifyBundleReadAccess(currentUser, compartment, isAdmin, isManager);
            candidates.addAll(fridgeBundleRepository.findByFridgeCompartmentAndStatus(
                    compartment,
                    includeRemoved ? FridgeBundleStatus.REMOVED : FridgeBundleStatus.ACTIVE));
            if (includeRemoved) {
                // include removed bundles as well
                candidates.addAll(fridgeBundleRepository.findByFridgeCompartmentAndStatus(
                        compartment,
                        FridgeBundleStatus.ACTIVE));
            }
        } else if (ownerFilter != null) {
            candidates.addAll(fridgeBundleRepository.findByOwner(currentUser));
        } else {
            // 관리자/층별장 전체 조회
            candidates.addAll(fridgeBundleRepository.findAll());
        }

        if (!includeRemoved) {
            candidates = candidates.stream()
                    .filter(b -> b.getStatus() == FridgeBundleStatus.ACTIVE)
                    .toList();
        }

        final UUID finalOwnerFilter = ownerFilter;
        if (finalOwnerFilter != null) {
            candidates = candidates.stream()
                    .filter(bundle -> bundle.getOwner().getId().equals(finalOwnerFilter))
                    .toList();
        }

        if (StringUtils.hasText(search)) {
            String keyword = search.trim().toLowerCase();
            candidates = candidates.stream()
                    .filter(bundle -> matchesSearch(bundle, keyword))
                    .toList();
        }

        Map<UUID, RoomAssignment> ownerAssignments = loadAssignmentsForBundles(candidates);

        List<FridgeBundleSummaryResponse> summaries = candidates.stream()
                .sorted(Comparator.comparing(FridgeBundle::getCreatedAt).reversed())
                .map(bundle -> FridgeDtoMapper.toSummary(bundle, ownerAssignments.get(bundle.getOwner().getId())))
                .toList();

        return new BundleListResponse(summaries, summaries.size());
    }

    @Transactional(readOnly = true)
    public FridgeBundleResponse getBundle(UUID bundleId) {
        UUID currentUserId = SecurityUtils.getCurrentUserId();
        DormUser currentUser = loadUser(currentUserId);
        boolean isAdmin = SecurityUtils.hasRole("ADMIN");
        boolean isManager = SecurityUtils.hasRole("FLOOR_MANAGER");

        FridgeBundle bundle = fridgeBundleRepository.findById(bundleId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "BUNDLE_NOT_FOUND"));

        verifyBundleReadAccess(currentUser, bundle.getFridgeCompartment(), isAdmin, isManager);
        if (!isAdmin && !isManager && !bundle.getOwner().getId().equals(currentUserId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "NOT_BUNDLE_OWNER");
        }

        RoomAssignment ownerAssignment = roomAssignmentRepository.findActiveAssignment(bundle.getOwner().getId())
                .orElse(null);
        return FridgeDtoMapper.toResponse(bundle, ownerAssignment);
    }

    public CreateBundleResponse createBundle(CreateBundleRequest request) {
        UUID currentUserId = SecurityUtils.getCurrentUserId();
        DormUser currentUser = loadUser(currentUserId);
        FridgeCompartment compartment = fridgeCompartmentRepository.findBySlotCode(request.slotCode())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "SLOT_NOT_FOUND"));

        verifyBundleWriteAccess(currentUser, compartment);
        ensureCompartmentNotLocked(compartment);

        int activeBundleCount = (int) fridgeBundleRepository.findByFridgeCompartmentAndStatus(
                compartment, FridgeBundleStatus.ACTIVE).stream().count();
        if (activeBundleCount >= compartment.getMaxBundleCount()) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "CAPACITY_EXCEEDED");
        }

        String nextLabel = allocateLabel(compartment);
        OffsetDateTime now = OffsetDateTime.now(clock);

        FridgeBundle bundle = new FridgeBundle();
        bundle.setOwner(currentUser);
        bundle.setFridgeCompartment(compartment);
        bundle.setLabelCode(nextLabel);
        bundle.setBundleName(request.bundleName());
        bundle.setMemo(request.memo());

        List<FridgeItem> items = new ArrayList<>();
        int seq = 1;
        for (CreateBundleItemInput input : request.items()) {
            items.add(buildItem(currentUser, bundle, seq++, input.name(), input.expiryDate(), input.quantity(),
                    input.priority(), input.memo(), now));
        }
        bundle.getItems().addAll(items);

        FridgeBundle saved = fridgeBundleRepository.save(bundle);
        RoomAssignment ownerAssignment = roomAssignmentRepository.findActiveAssignment(currentUserId)
                .orElse(null);
        return new CreateBundleResponse(FridgeDtoMapper.toResponse(saved, ownerAssignment));
    }

    public FridgeBundleResponse updateBundle(UUID bundleId, UpdateBundleRequest request) {
        FridgeBundle bundle = fridgeBundleRepository.findById(bundleId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "BUNDLE_NOT_FOUND"));
        UUID currentUserId = SecurityUtils.getCurrentUserId();
        DormUser currentUser = loadUser(currentUserId);

        verifyBundleWriteAccess(currentUser, bundle.getFridgeCompartment());
        ensureBundleOwnerOrManager(bundle, currentUser);
        ensureCompartmentNotLocked(bundle.getFridgeCompartment());

        if (StringUtils.hasText(request.bundleName())) {
            bundle.setBundleName(request.bundleName().trim());
        }
        if (request.memo() != null) {
            bundle.setMemo(request.memo());
        }

        if (request.removedAt() != null) {
            softDeleteBundle(bundle, request.removedAt());
        }

        FridgeBundle saved = fridgeBundleRepository.save(bundle);
        RoomAssignment ownerAssignment = roomAssignmentRepository.findActiveAssignment(bundle.getOwner().getId())
                .orElse(null);
        return FridgeDtoMapper.toResponse(saved, ownerAssignment);
    }

    public void deleteBundle(UUID bundleId) {
        FridgeBundle bundle = fridgeBundleRepository.findById(bundleId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "BUNDLE_NOT_FOUND"));
        UUID currentUserId = SecurityUtils.getCurrentUserId();
        DormUser currentUser = loadUser(currentUserId);

        verifyBundleWriteAccess(currentUser, bundle.getFridgeCompartment());
        ensureBundleOwnerOrManager(bundle, currentUser);
        ensureCompartmentNotLocked(bundle.getFridgeCompartment());

        softDeleteBundle(bundle, OffsetDateTime.now(clock));
        fridgeBundleRepository.save(bundle);
    }

    public FridgeItemResponse addItem(UUID bundleId, AddItemRequest request) {
        FridgeBundle bundle = fridgeBundleRepository.findById(bundleId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "BUNDLE_NOT_FOUND"));
        UUID currentUserId = SecurityUtils.getCurrentUserId();
        DormUser currentUser = loadUser(currentUserId);

        verifyBundleWriteAccess(currentUser, bundle.getFridgeCompartment());
        ensureBundleOwnerOrManager(bundle, currentUser);
        ensureCompartmentNotLocked(bundle.getFridgeCompartment());

        OffsetDateTime now = OffsetDateTime.now(clock);
        int nextSequence = bundle.getItems().stream()
                .mapToInt(FridgeItem::getSequenceNo)
                .max()
                .orElse(0) + 1;

        FridgeItem item = buildItem(currentUser, bundle, nextSequence, request.name(), request.expiryDate(),
                request.quantity(), request.priority(), request.memo(), now);
        bundle.getItems().add(item);
        fridgeBundleRepository.save(bundle);

        return FridgeDtoMapper.toItemResponse(item);
    }

    public FridgeItemResponse updateItem(UUID itemId, UpdateItemRequest request) {
        FridgeItem item = fridgeItemRepository.findById(itemId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "ITEM_NOT_FOUND"));
        FridgeBundle bundle = item.getBundle();
        UUID currentUserId = SecurityUtils.getCurrentUserId();
        DormUser currentUser = loadUser(currentUserId);

        verifyBundleWriteAccess(currentUser, bundle.getFridgeCompartment());
        ensureBundleOwnerOrManager(bundle, currentUser);
        ensureCompartmentNotLocked(bundle.getFridgeCompartment());

        OffsetDateTime now = OffsetDateTime.now(clock);

        if (StringUtils.hasText(request.name())) {
            item.setItemName(request.name().trim());
        }
        if (request.expiryDate() != null) {
            item.setExpiresOn(request.expiryDate());
        }
        if (request.quantity() != null) {
            item.setQuantity(request.quantity());
        }
        if (request.priority() != null) {
            item.setPriority(parsePriority(request.priority()));
        }
        if (request.memo() != null) {
            item.setMemo(request.memo());
        }
        if (request.removedAt() != null) {
            item.setStatus(FridgeItemStatus.REMOVED);
            item.setDeletedAt(request.removedAt());
        } else {
            item.setStatus(FridgeItemStatus.ACTIVE);
            item.setDeletedAt(null);
        }
        item.setPostInspectionModified(true);
        item.setLastModifiedAt(now);
        item.setLastModifiedBy(currentUser);

        FridgeItem saved = fridgeItemRepository.save(item);
        return FridgeDtoMapper.toItemResponse(saved);
    }

    public void deleteItem(UUID itemId) {
        FridgeItem item = fridgeItemRepository.findById(itemId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "ITEM_NOT_FOUND"));
        FridgeBundle bundle = item.getBundle();
        UUID currentUserId = SecurityUtils.getCurrentUserId();
        DormUser currentUser = loadUser(currentUserId);

        verifyBundleWriteAccess(currentUser, bundle.getFridgeCompartment());
        ensureBundleOwnerOrManager(bundle, currentUser);
        ensureCompartmentNotLocked(bundle.getFridgeCompartment());

        item.setStatus(FridgeItemStatus.REMOVED);
        item.setDeletedAt(OffsetDateTime.now(clock));
        item.setLastModifiedAt(OffsetDateTime.now(clock));
        item.setLastModifiedBy(currentUser);
        item.setPostInspectionModified(true);

        fridgeItemRepository.save(item);
    }

    private void ensureBundleOwnerOrManager(FridgeBundle bundle, DormUser currentUser) {
        if (bundle.getOwner().getId().equals(currentUser.getId())) {
            return;
        }
        if (SecurityUtils.hasRole("ADMIN") || SecurityUtils.hasRole("FLOOR_MANAGER")) {
            return;
        }
        throw new ResponseStatusException(HttpStatus.FORBIDDEN, "NOT_BUNDLE_OWNER");
    }

    private DormUser loadUser(UUID userId) {
        return dormUserRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "USER_NOT_FOUND"));
    }

    private FridgeSlotResponse mapSlot(short floor, FridgeCompartment compartment, boolean fullView) {
        String type = "FRIDGE_COMP";
        String status = compartment.isActive() ? "ACTIVE" : "OUT_OF_SERVICE";
        String temperature = switch (compartment.getCompartmentType()) {
            case FREEZER -> "freezer";
            case REFRIGERATOR -> "refrigerator";
        };
        String displayName = generateDisplayName(floor, compartment);

        return new FridgeSlotResponse(
                compartment.getId(),
                compartment.getSlotCode(),
                floor,
                floor + "F",
                type,
                status,
                fullView ? (int) compartment.getLabelRangeStart() : null,
                fullView ? (int) compartment.getLabelRangeEnd() : null,
                fullView ? (int) compartment.getMaxBundleCount() : null,
                fullView ? temperature : null,
                fullView ? (int) compartment.getDisplayOrder() : null,
                fullView ? displayName : null,
                compartment.isActive()
        );
    }

    private String generateDisplayName(short floor, FridgeCompartment compartment) {
        String typeLabel = compartment.getCompartmentType() == com.dormmate.backend.modules.fridge.domain.CompartmentType.FREEZER
                ? "냉동"
                : "냉장";
        return floor + "F " + typeLabel + " " + compartment.getDisplayOrder() + "칸";
    }

    private boolean matchesSearch(FridgeBundle bundle, String keyword) {
        if (bundle.getBundleName() != null && bundle.getBundleName().toLowerCase().contains(keyword)) {
            return true;
        }
        if (bundle.getLabelCode() != null && bundle.getLabelCode().toLowerCase().contains(keyword)) {
            return true;
        }
        return bundle.getItems().stream()
                .anyMatch(item -> item.getItemName() != null && item.getItemName().toLowerCase().contains(keyword));
    }

    private Map<UUID, RoomAssignment> loadAssignmentsForBundles(List<FridgeBundle> bundles) {
        Set<UUID> ownerIds = bundles.stream()
                .map(bundle -> bundle.getOwner().getId())
                .collect(Collectors.toSet());
        Map<UUID, RoomAssignment> result = new HashMap<>();
        for (UUID ownerId : ownerIds) {
            roomAssignmentRepository.findActiveAssignment(ownerId).ifPresent(assignment -> result.put(ownerId, assignment));
        }
        return result;
    }

    private void verifyBundleReadAccess(DormUser currentUser, FridgeCompartment compartment, boolean isAdmin, boolean isManager) {
        if (isAdmin || isManager) {
            return;
        }
        RoomAssignment assignment = roomAssignmentRepository.findActiveAssignment(currentUser.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN, "ROOM_ASSIGNMENT_REQUIRED"));
        List<CompartmentRoomAccess> accesses = compartmentRoomAccessRepository
                .findByFridgeCompartmentAndReleasedAtIsNullOrderByPriorityOrderAsc(compartment);
        boolean accessible = accesses.stream()
                .map(CompartmentRoomAccess::getRoom)
                .map(Room::getId)
                .anyMatch(roomId -> roomId.equals(assignment.getRoom().getId()));
        if (!accessible) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "FORBIDDEN_SLOT");
        }
    }

    private void verifyBundleWriteAccess(DormUser currentUser, FridgeCompartment compartment) {
        boolean isAdmin = SecurityUtils.hasRole("ADMIN");
        boolean isManager = SecurityUtils.hasRole("FLOOR_MANAGER");
        if (isAdmin || isManager) {
            return;
        }
        verifyBundleReadAccess(currentUser, compartment, isAdmin, isManager);
    }

    private String allocateLabel(FridgeCompartment compartment) {
        BundleLabelSequence sequence = bundleLabelSequenceRepository
                .findByFridgeCompartmentId(compartment.getId())
                .orElseGet(() -> {
                    BundleLabelSequence created = new BundleLabelSequence();
                    created.setFridgeCompartment(compartment);
                    created.setNextLabel((short) 1);
                    return created;
                });

        short current = sequence.getNextLabel();
        for (int i = 0; i < MAX_LABEL; i++) {
            String labelCode = String.format("%03d", current);
            boolean exists = fridgeBundleRepository
                    .findByFridgeCompartmentAndLabelCodeAndStatus(compartment, labelCode, FridgeBundleStatus.ACTIVE)
                    .isPresent();
            if (!exists) {
                sequence.setNextLabel(nextLabelValue(current));
                bundleLabelSequenceRepository.save(sequence);
                return labelCode;
            }
            current = nextLabelValue(current);
        }
        throw new ResponseStatusException(HttpStatus.CONFLICT, "LABEL_POOL_EXHAUSTED");
    }

    private short nextLabelValue(short value) {
        short next = (short) (value + 1);
        if (next > MAX_LABEL) {
            next = 1;
        }
        return next;
    }

    private FridgeItem buildItem(
            DormUser currentUser,
            FridgeBundle bundle,
            int sequence,
            String name,
            LocalDate expiryDate,
            Integer quantityOpt,
            String priorityRaw,
            String memo,
            OffsetDateTime now
    ) {
        int quantity = quantityOpt != null ? quantityOpt : 1;
        if (quantity <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "INVALID_QUANTITY");
        }

        FridgeItem item = new FridgeItem();
        item.setBundle(bundle);
        item.setSequenceNo(sequence);
        item.setItemName(name);
        item.setExpiresOn(expiryDate);
        item.setQuantity(quantity);
        item.setUnit(null);
        item.setPriority(parsePriority(priorityRaw));
        item.setMemo(memo);
        item.setStatus(FridgeItemStatus.ACTIVE);
        item.setPostInspectionModified(false);
        item.setLastModifiedAt(now);
        item.setLastModifiedBy(currentUser);
        return item;
    }

    private FridgeItemPriority parsePriority(String priorityRaw) {
        if (!StringUtils.hasText(priorityRaw)) {
            return null;
        }
        try {
            return FridgeItemPriority.valueOf(priorityRaw.trim().toUpperCase());
        } catch (IllegalArgumentException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "INVALID_PRIORITY");
        }
    }

    private void softDeleteBundle(FridgeBundle bundle, OffsetDateTime removedAt) {
        OffsetDateTime ts = Objects.requireNonNullElse(removedAt, OffsetDateTime.now(clock));
        bundle.setStatus(FridgeBundleStatus.REMOVED);
        bundle.setDeletedAt(ts);
        bundle.getItems().forEach(item -> {
            item.setStatus(FridgeItemStatus.REMOVED);
            item.setDeletedAt(ts);
        });
    }

    private void ensureCompartmentNotLocked(FridgeCompartment compartment) {
        OffsetDateTime now = OffsetDateTime.now(clock);
        if (compartment.getLockedUntil() != null && compartment.getLockedUntil().isAfter(now)) {
            throw new ResponseStatusException(HttpStatus.LOCKED, "COMPARTMENT_LOCKED");
        }
        boolean activeSessionExists = inspectionSessionRepository
                .findByFridgeCompartmentAndStatus(compartment, com.dormmate.backend.modules.inspection.domain.InspectionStatus.IN_PROGRESS)
                .stream()
                .findAny()
                .isPresent();
        if (activeSessionExists) {
            throw new ResponseStatusException(HttpStatus.LOCKED, "COMPARTMENT_UNDER_INSPECTION");
        }
    }
}

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
import com.dormmate.backend.modules.fridge.domain.FridgeItemStatus;
import com.dormmate.backend.modules.fridge.domain.FridgeUnit;
import com.dormmate.backend.modules.fridge.domain.LabelFormatter;
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
        boolean fullView = "full".equalsIgnoreCase(view);
        UUID currentUserId = SecurityUtils.getCurrentUserId();
        boolean isAdmin = SecurityUtils.hasRole("ADMIN");
        boolean isFloorManager = SecurityUtils.hasRole("FLOOR_MANAGER");

        Short floorFilter = floorParam != null ? floorParam.shortValue() : null;

        Set<UUID> accessibleCompartmentIds = null;
        if (!isAdmin) {
            RoomAssignment assignment = roomAssignmentRepository.findActiveAssignment(currentUserId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN, "ROOM_ASSIGNMENT_REQUIRED"));
            if (isFloorManager) {
                short managedFloor = assignment.getRoom().getFloor();
                if (floorFilter != null && !Objects.equals(floorFilter, managedFloor)) {
                    throw new ResponseStatusException(HttpStatus.FORBIDDEN, "FLOOR_SCOPE_VIOLATION");
                }
                floorFilter = managedFloor;
            } else {
                accessibleCompartmentIds = new HashSet<>();
                List<CompartmentRoomAccess> accesses = compartmentRoomAccessRepository.findByRoomIdAndReleasedAtIsNull(
                        assignment.getRoom().getId());
                for (CompartmentRoomAccess access : accesses) {
                    accessibleCompartmentIds.add(access.getFridgeCompartment().getId());
                }
            }
        }

        List<FridgeUnit> units = floorFilter != null
                ? fridgeUnitRepository.findByFloorNo(floorFilter)
                : fridgeUnitRepository.findAll();

        List<FridgeSlotResponse> results = new ArrayList<>();
        for (FridgeUnit unit : units) {
            List<FridgeCompartment> compartments = fridgeCompartmentRepository
                    .findByFridgeUnitOrderBySlotIndexAsc(unit);
            for (FridgeCompartment compartment : compartments) {
                if (accessibleCompartmentIds != null && !accessibleCompartmentIds.contains(compartment.getId())) {
                    continue;
                }
                results.add(FridgeDtoMapper.toSlotResponse(compartment, fullView));
            }
        }

        results.sort(Comparator
                .comparingInt(FridgeSlotResponse::floorNo)
                .thenComparingInt(FridgeSlotResponse::slotIndex));
        return results;
    }

    @Transactional(readOnly = true)
    public BundleListResponse getBundles(
            UUID slotId,
            String ownerSelector,
            String statusSelector,
            String search,
            int page,
            int size
    ) {
        UUID currentUserId = SecurityUtils.getCurrentUserId();
        DormUser currentUser = loadUser(currentUserId);
        boolean isAdmin = SecurityUtils.hasRole("ADMIN");
        boolean isFloorManager = SecurityUtils.hasRole("FLOOR_MANAGER");
        int safePage = Math.max(page, 0);
        int safeSize = Math.min(Math.max(size, 1), 100);
        boolean includeDeleted = "deleted".equalsIgnoreCase(statusSelector)
                || "removed".equalsIgnoreCase(statusSelector);

        UUID ownerFilter = null;
        if ("all".equalsIgnoreCase(ownerSelector)) {
            if (!isAdmin) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "FORBIDDEN");
            }
        } else if (!isAdmin) {
            ownerFilter = currentUserId;
        }

        List<FridgeBundle> candidates = new ArrayList<>();

        if (slotId != null) {
            FridgeCompartment compartment = fridgeCompartmentRepository.findById(slotId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "SLOT_NOT_FOUND"));
            verifyBundleReadAccess(currentUser, compartment, isAdmin, true);
            if (ownerFilter != null && isFloorManager) {
                boolean managesFloor = roomAssignmentRepository.findActiveAssignment(currentUserId)
                        .map(assignment -> assignment.getRoom().getFloor()
                                == compartment.getFridgeUnit().getFloorNo())
                        .orElse(false);
                if (managesFloor) {
                    ownerFilter = null;
                }
            }
            candidates.addAll(fridgeBundleRepository.findByFridgeCompartmentAndStatus(compartment, FridgeBundleStatus.ACTIVE));
            if (includeDeleted) {
                candidates.addAll(fridgeBundleRepository.findByFridgeCompartmentAndStatus(compartment, FridgeBundleStatus.DELETED));
            }
        } else if (ownerFilter != null) {
            candidates.addAll(fridgeBundleRepository.findByOwner(currentUser));
        } else {
            // 관리자 전체 조회
            candidates.addAll(fridgeBundleRepository.findAll());
        }

        if (!includeDeleted) {
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

        Comparator<FridgeBundle> comparator = Comparator.comparing(FridgeBundle::getCreatedAt).reversed();
        List<FridgeBundle> sorted = candidates.stream()
                .sorted(comparator)
                .toList();

        long total = sorted.size();

        List<FridgeBundle> paged = sorted.stream()
                .skip((long) safePage * safeSize)
                .limit(safeSize)
                .toList();

        Map<UUID, RoomAssignment> ownerAssignments = loadAssignmentsForBundles(paged);

        List<FridgeBundleSummaryResponse> summaries = paged.stream()
                .map(bundle -> FridgeDtoMapper.toSummary(
                        bundle,
                        ownerAssignments.get(bundle.getOwner().getId()),
                        bundle.getOwner().getId().equals(currentUserId)
                ))
                .toList();

        return new BundleListResponse(summaries, total);
    }

    @Transactional(readOnly = true)
    public FridgeBundleResponse getBundle(UUID bundleId) {
        UUID currentUserId = SecurityUtils.getCurrentUserId();
        DormUser currentUser = loadUser(currentUserId);
        boolean isAdmin = SecurityUtils.hasRole("ADMIN");
        boolean isFloorManager = SecurityUtils.hasRole("FLOOR_MANAGER");
        FridgeBundle bundle = fridgeBundleRepository.findById(bundleId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "BUNDLE_NOT_FOUND"));

        verifyBundleReadAccess(currentUser, bundle.getFridgeCompartment(), isAdmin, true);
        boolean isOwner = bundle.getOwner().getId().equals(currentUserId);
        boolean managerHasAccess = false;
        if (isFloorManager && !isAdmin && !isOwner) {
            managerHasAccess = roomAssignmentRepository.findActiveAssignment(currentUserId)
                    .map(assignment -> assignment.getRoom().getFloor()
                            == bundle.getFridgeCompartment().getFridgeUnit().getFloorNo())
                    .orElse(false);
        }
        if (!isAdmin && !isOwner && !managerHasAccess) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "NOT_BUNDLE_OWNER");
        }

        RoomAssignment ownerAssignment = roomAssignmentRepository.findActiveAssignment(bundle.getOwner().getId())
                .orElse(null);
        boolean includeMemo = isOwner;
        return FridgeDtoMapper.toResponse(bundle, ownerAssignment, includeMemo);
    }

    public CreateBundleResponse createBundle(CreateBundleRequest request) {
        UUID currentUserId = SecurityUtils.getCurrentUserId();
        DormUser currentUser = loadUser(currentUserId);
        FridgeCompartment compartment = fridgeCompartmentRepository.findById(request.slotId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "SLOT_NOT_FOUND"));

        verifyBundleWriteAccess(currentUser, compartment);
        ensureCompartmentNotLocked(compartment);

        int activeBundleCount = (int) fridgeBundleRepository.findByFridgeCompartmentAndStatus(
                compartment, FridgeBundleStatus.ACTIVE).stream().count();
        if (activeBundleCount >= compartment.getMaxBundleCount()) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "CAPACITY_EXCEEDED");
        }

        int labelNumber = allocateLabelNumber(compartment);
        FridgeBundle bundle = new FridgeBundle();
        bundle.setOwner(currentUser);
        bundle.setFridgeCompartment(compartment);
        bundle.setLabelNumber(labelNumber);
        bundle.setBundleName(request.bundleName());
        bundle.setMemo(request.memo());

        for (CreateBundleItemInput input : request.items()) {
            bundle.getItems().add(buildItem(bundle, input.name(), input.expiryDate(), input.quantity(), input.unitCode()));
        }

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
        ensureBundleActive(bundle);

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
        ensureBundleActive(bundle);

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
        ensureBundleActive(bundle);

        FridgeItem item = buildItem(bundle, request.name(), request.expiryDate(),
                request.quantity(), request.unitCode());
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
        ensureBundleActive(bundle);

        if (StringUtils.hasText(request.name())) {
            item.setItemName(request.name().trim());
        }
        if (request.expiryDate() != null) {
            item.setExpiryDate(request.expiryDate());
        }
        if (request.quantity() != null) {
            item.setQuantity(request.quantity());
        }
        if (request.unitCode() != null) {
            item.setUnitCode(request.unitCode().isBlank() ? null : request.unitCode().trim());
        }
        if (request.removedAt() != null) {
            item.setStatus(FridgeItemStatus.DELETED);
            item.setDeletedAt(request.removedAt());
        } else if (item.getStatus() == FridgeItemStatus.DELETED) {
            item.setStatus(FridgeItemStatus.ACTIVE);
            item.setDeletedAt(null);
        }

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
        ensureBundleActive(bundle);

        OffsetDateTime ts = OffsetDateTime.now(clock);
        item.setStatus(FridgeItemStatus.DELETED);
        item.setDeletedAt(ts);

        fridgeItemRepository.save(item);
    }

    private void ensureBundleOwnerOrManager(FridgeBundle bundle, DormUser currentUser) {
        if (bundle.getOwner().getId().equals(currentUser.getId())) {
            return;
        }
        if (SecurityUtils.hasRole("ADMIN")) {
            return;
        }
        throw new ResponseStatusException(HttpStatus.FORBIDDEN, "NOT_BUNDLE_OWNER");
    }

    private void ensureBundleActive(FridgeBundle bundle) {
        if (!bundle.isActive()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "BUNDLE_REMOVED");
        }
    }

    private DormUser loadUser(UUID userId) {
        return dormUserRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "USER_NOT_FOUND"));
    }

    private boolean matchesSearch(FridgeBundle bundle, String keyword) {
        if (bundle.getBundleName() != null && bundle.getBundleName().toLowerCase().contains(keyword)) {
            return true;
        }
        String labelNumber = LabelFormatter.formatLabelNumber(bundle.getLabelNumber()).toLowerCase();
        if (labelNumber.contains(keyword)) {
            return true;
        }
        String labelDisplay = LabelFormatter.toBundleLabel(
                bundle.getFridgeCompartment().getSlotIndex(),
                bundle.getLabelNumber()).toLowerCase();
        if (labelDisplay.contains(keyword)) {
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

    private void verifyBundleReadAccess(
            DormUser currentUser,
            FridgeCompartment compartment,
            boolean isAdmin,
            boolean allowFloorManager
    ) {
        if (!compartment.getStatus().isActive()) {
            if (isAdmin) {
                return;
            }
            throw new ResponseStatusException(HttpStatus.LOCKED, "COMPARTMENT_SUSPENDED");
        }

        if (isAdmin) {
            return;
        }
        RoomAssignment assignment = roomAssignmentRepository.findActiveAssignment(currentUser.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN, "ROOM_ASSIGNMENT_REQUIRED"));

        if (allowFloorManager && SecurityUtils.hasRole("FLOOR_MANAGER")) {
            short managedFloor = assignment.getRoom().getFloor();
            short compartmentFloor = compartment.getFridgeUnit().getFloorNo();
            if (managedFloor == compartmentFloor) {
                return;
            }
        }

        List<CompartmentRoomAccess> accesses = compartmentRoomAccessRepository
                .findByFridgeCompartmentIdAndReleasedAtIsNullOrderByAssignedAtAsc(compartment.getId());
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
        if (isAdmin) {
            return;
        }
        verifyBundleReadAccess(currentUser, compartment, isAdmin, false);
    }

    private int allocateLabelNumber(FridgeCompartment compartment) {
        BundleLabelSequence sequence = bundleLabelSequenceRepository
                .findByFridgeCompartmentId(compartment.getId())
                .orElseGet(() -> {
                    BundleLabelSequence created = new BundleLabelSequence();
                    created.setFridgeCompartment(compartment);
                    created.setNextNumber(1);
                    created.setRecycledNumbers(new ArrayList<>());
                    return created;
                });

        List<Integer> recycled = new ArrayList<>(sequence.getRecycledNumbers());
        if (!recycled.isEmpty()) {
            recycled.sort(Integer::compareTo);
            int reused = recycled.remove(0);
            sequence.setRecycledNumbers(recycled);
            bundleLabelSequenceRepository.save(sequence);
            return reused;
        }

        int candidate = sequence.getNextNumber();
        for (int i = 0; i < MAX_LABEL; i++) {
            int labelCandidate = wrapLabel(candidate + i);
            boolean exists = fridgeBundleRepository
                    .findByFridgeCompartmentAndLabelNumberAndStatus(compartment, labelCandidate, FridgeBundleStatus.ACTIVE)
                    .isPresent();
            if (!exists) {
                sequence.setNextNumber(wrapLabel(labelCandidate + 1));
                bundleLabelSequenceRepository.save(sequence);
                return labelCandidate;
            }
        }
        throw new ResponseStatusException(HttpStatus.CONFLICT, "LABEL_POOL_EXHAUSTED");
    }

    private int wrapLabel(int value) {
        int normalized = value % MAX_LABEL;
        return normalized == 0 ? MAX_LABEL : normalized;
    }

    private FridgeItem buildItem(
            FridgeBundle bundle,
            String name,
            LocalDate expiryDate,
            Integer quantityOpt,
            String unitCode
    ) {
        int quantity = quantityOpt != null ? quantityOpt : 1;
        if (quantity <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "INVALID_QUANTITY");
        }

        String itemName = name != null ? name.trim() : null;
        if (!StringUtils.hasText(itemName)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "INVALID_NAME");
        }

        if (expiryDate == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "INVALID_EXPIRY");
        }

        FridgeItem item = new FridgeItem();
        item.setBundle(bundle);
        item.setItemName(itemName);
        item.setExpiryDate(expiryDate);
        item.setQuantity(quantity);
        item.setUnitCode(unitCode != null && !unitCode.isBlank() ? unitCode.trim() : null);
        item.setStatus(FridgeItemStatus.ACTIVE);
        item.setDeletedAt(null);
        return item;
    }

    private void softDeleteBundle(FridgeBundle bundle, OffsetDateTime removedAt) {
        if (bundle.getStatus() == FridgeBundleStatus.DELETED) {
            return;
        }
        OffsetDateTime ts = Objects.requireNonNullElse(removedAt, OffsetDateTime.now(clock));
        bundle.setStatus(FridgeBundleStatus.DELETED);
        bundle.setDeletedAt(ts);
        bundle.getItems().forEach(item -> {
            item.setStatus(FridgeItemStatus.DELETED);
            item.setDeletedAt(ts);
        });

        bundleLabelSequenceRepository.findByFridgeCompartmentId(bundle.getFridgeCompartment().getId())
                .ifPresent(sequence -> {
                    List<Integer> recycled = new ArrayList<>(sequence.getRecycledNumbers());
                    if (!recycled.contains(bundle.getLabelNumber())) {
                        recycled.add(bundle.getLabelNumber());
                        recycled.sort(Integer::compareTo);
                        sequence.setRecycledNumbers(recycled);
                        bundleLabelSequenceRepository.save(sequence);
                    }
                });
    }

    private void ensureCompartmentNotLocked(FridgeCompartment compartment) {
        OffsetDateTime now = OffsetDateTime.now(clock);
        if (compartment.getLockedUntil() != null && compartment.getLockedUntil().isBefore(now)) {
            compartment.setLocked(false);
            compartment.setLockedUntil(null);
        }
        if (compartment.isLocked()) {
            if (compartment.getLockedUntil() == null || compartment.getLockedUntil().isAfter(now)) {
                throw new ResponseStatusException(HttpStatus.LOCKED, "COMPARTMENT_LOCKED");
            }
        }
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

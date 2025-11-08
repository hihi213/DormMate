package com.dormmate.backend.modules.fridge.application;

import static com.dormmate.backend.modules.auth.application.RoomAssignmentSupport.isFloorManagerOnFloor;
import static com.dormmate.backend.modules.auth.application.RoomAssignmentSupport.requireRoom;
import static com.dormmate.backend.modules.auth.application.RoomAssignmentSupport.requireRoomId;

import java.time.Clock;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.*;
import java.util.stream.Collectors;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;

import com.dormmate.backend.modules.fridge.presentation.dto.BundleListResponse;
import com.dormmate.backend.modules.fridge.presentation.dto.CreateBundleItemInput;
import com.dormmate.backend.modules.fridge.presentation.dto.CreateBundleRequest;
import com.dormmate.backend.modules.fridge.presentation.dto.CreateBundleResponse;
import com.dormmate.backend.modules.fridge.presentation.dto.FridgeBundleResponse;
import com.dormmate.backend.modules.fridge.presentation.dto.FridgeBundleSummaryResponse;
import com.dormmate.backend.modules.fridge.presentation.dto.FridgeDtoMapper;
import com.dormmate.backend.modules.fridge.presentation.dto.FridgeItemResponse;
import com.dormmate.backend.modules.fridge.presentation.dto.FridgeSlotListResponse;
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
import com.dormmate.backend.modules.fridge.infrastructure.persistence.FridgeBundleSearchCondition;
import com.dormmate.backend.modules.fridge.infrastructure.persistence.FridgeBundleSearchOrder;
import com.dormmate.backend.modules.fridge.infrastructure.persistence.FridgeCompartmentRepository;
import com.dormmate.backend.modules.fridge.infrastructure.persistence.FridgeItemRepository;
import com.dormmate.backend.modules.fridge.infrastructure.persistence.FridgeUnitRepository;
import com.dormmate.backend.modules.inspection.infrastructure.persistence.InspectionSessionRepository;
import com.dormmate.backend.global.security.SecurityUtils;

import org.springframework.core.NestedExceptionUtils;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

@Service
@Transactional
public class FridgeService {

    private static final int MAX_LABEL = 999;
    private static final Pattern LABEL_SEARCH_PATTERN = Pattern.compile("([A-Za-z]+)[-\\s]?([0-9]{1,3})");
    private static final Pattern SLOT_LETTER_TOKEN_PATTERN = Pattern.compile("\\b([A-Za-z]{1,4})\\b");
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
    public FridgeSlotListResponse getSlots(Integer floorParam, String view, Integer pageParam, Integer sizeParam) {
        boolean fullView = "full".equalsIgnoreCase(view);
        UUID currentUserId = SecurityUtils.getCurrentUserId();
        boolean isAdmin = SecurityUtils.hasRole("ADMIN");
        boolean isFloorManager = SecurityUtils.hasRole("FLOOR_MANAGER");

        Short floorFilter = floorParam != null ? floorParam.shortValue() : null;
        int safePage = pageParam != null && pageParam >= 0 ? pageParam : 0;
        int safeSize = sizeParam != null && sizeParam > 0 ? Math.min(sizeParam, 200) : 20;

        Set<UUID> accessibleCompartmentIds = null;
        if (!isAdmin) {
            RoomAssignment assignment = roomAssignmentRepository.findActiveAssignment(currentUserId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN, "ROOM_ASSIGNMENT_REQUIRED"));
            Room assignedRoom = requireRoom(assignment);
            if (isFloorManager) {
                short managedFloor = assignedRoom.getFloor();
                if (floorFilter != null && !Objects.equals(floorFilter, managedFloor)) {
                    throw new ResponseStatusException(HttpStatus.FORBIDDEN, "FLOOR_SCOPE_VIOLATION");
                }
                floorFilter = managedFloor;
            } else {
                accessibleCompartmentIds = new HashSet<>();
                UUID roomId = requireRoomId(assignment);
                List<CompartmentRoomAccess> accesses = compartmentRoomAccessRepository.findByRoomIdAndReleasedAtIsNull(roomId);
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
        int total = results.size();
        int fromIndex = Math.min(safePage * safeSize, total);
        int toIndex = Math.min(fromIndex + safeSize, total);
        List<FridgeSlotResponse> paged = results.subList(fromIndex, toIndex);
        int totalPages = (int) Math.ceil(total / (double) safeSize);
        return new FridgeSlotListResponse(paged, total, safePage, safeSize, totalPages);
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
        boolean requestDeletedOnly = "deleted".equalsIgnoreCase(statusSelector)
                || "removed".equalsIgnoreCase(statusSelector);
        boolean requestAllStatuses = "all".equalsIgnoreCase(statusSelector);

        UUID ownerFilter = null;
        if ("all".equalsIgnoreCase(ownerSelector)) {
            if (!isAdmin) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "FORBIDDEN");
            }
        } else if (!isAdmin) {
            ownerFilter = currentUserId;
        }

        UUID finalOwnerFilter = ownerFilter;
        UUID compartmentId = null;

        if (slotId != null) {
            FridgeCompartment compartment = fridgeCompartmentRepository.findById(slotId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "SLOT_NOT_FOUND"));
            verifyBundleReadAccess(currentUser, compartment, isAdmin, true);
            if (finalOwnerFilter != null && isFloorManager) {
                boolean managesFloor = roomAssignmentRepository.findActiveAssignment(currentUserId)
                .map(assignment -> requireRoom(assignment).getFloor()
                                == compartment.getFridgeUnit().getFloorNo())
                        .orElse(false);
                if (managesFloor) {
                    finalOwnerFilter = null;
                }
            }
            compartmentId = compartment.getId();
        }

        Set<FridgeBundleStatus> statuses;
        if (requestDeletedOnly) {
            statuses = EnumSet.of(FridgeBundleStatus.DELETED);
        } else if (requestAllStatuses) {
            statuses = EnumSet.of(FridgeBundleStatus.ACTIVE, FridgeBundleStatus.DELETED);
        } else {
            statuses = EnumSet.of(FridgeBundleStatus.ACTIVE);
        }

        String trimmedSearch = StringUtils.hasText(search) ? search.trim() : null;
        String normalizedKeyword = trimmedSearch != null ? trimmedSearch.toLowerCase() : null;
        LabelSearchCriteria labelCriteria = parseLabelSearch(trimmedSearch).orElse(null);
        List<Integer> slotLetterCandidates = extractSlotLetterCandidates(trimmedSearch);

        FridgeBundleSearchCondition condition = new FridgeBundleSearchCondition(
                compartmentId,
                finalOwnerFilter,
                statuses,
                normalizedKeyword,
                labelCriteria != null ? labelCriteria.slotIndex() : null,
                labelCriteria != null ? labelCriteria.labelNumber() : null,
                StringUtils.hasText(normalizedKeyword),
                slotLetterCandidates,
                null,
                FridgeBundleSearchOrder.CREATED_AT_DESC
        );

        Page<FridgeBundle> resultPage = fridgeBundleRepository.searchBundles(
                condition,
                PageRequest.of(safePage, safeSize)
        );

        List<FridgeBundle> paged = resultPage.getContent();
        long total = resultPage.getTotalElements();

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

    public BundleListResponse getDeletedBundles(UUID slotId, OffsetDateTime since, int page, int size) {
        if (!SecurityUtils.hasRole("ADMIN")) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "FORBIDDEN");
        }
        int safePage = Math.max(page, 0);
        int safeSize = Math.min(Math.max(size, 1), 100);
        OffsetDateTime baseline = since != null ? since : OffsetDateTime.now(clock).minusMonths(3);

        FridgeBundleSearchCondition condition = new FridgeBundleSearchCondition(
                slotId,
                null,
                EnumSet.of(FridgeBundleStatus.DELETED),
                null,
                null,
                null,
                false,
                List.of(),
                baseline,
                FridgeBundleSearchOrder.DELETED_AT_DESC
        );

        Page<FridgeBundle> resultPage = fridgeBundleRepository.searchBundles(
                condition,
                PageRequest.of(safePage, safeSize)
        );

        Map<UUID, RoomAssignment> ownerAssignments = loadAssignmentsForBundles(resultPage.getContent());
        UUID currentUserId = SecurityUtils.getCurrentUserId();

        List<FridgeBundleSummaryResponse> summaries = resultPage.getContent().stream()
                .map(bundle -> FridgeDtoMapper.toSummary(
                        bundle,
                        ownerAssignments.get(bundle.getOwner().getId()),
                        bundle.getOwner().getId().equals(currentUserId)
                ))
                .toList();

        return new BundleListResponse(summaries, resultPage.getTotalElements());
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
                    .map(assignment -> requireRoom(assignment).getFloor()
                            == bundle.getFridgeCompartment().getFridgeUnit().getFloorNo())
                    .orElse(false);
        }
        if (!isAdmin && !isOwner && !managerHasAccess) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "NOT_BUNDLE_OWNER");
        }

        RoomAssignment ownerAssignment = roomAssignmentRepository.findActiveAssignment(bundle.getOwner().getId())
                .orElse(null);
        return FridgeDtoMapper.toResponse(bundle, ownerAssignment, isOwner);
    }

    public CreateBundleResponse createBundle(CreateBundleRequest request) {
        UUID currentUserId = SecurityUtils.getCurrentUserId();
        DormUser currentUser = loadUser(currentUserId);
        FridgeCompartment compartment = loadCompartmentForUpdate(request.slotId());

        verifyBundleWriteAccess(currentUser, compartment);
        ensureCompartmentNotLocked(compartment);

        int activeBundleCount = fridgeBundleRepository
                .findByFridgeCompartmentAndStatus(compartment, FridgeBundleStatus.ACTIVE)
                .size();
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

        try {
            FridgeBundle saved = fridgeBundleRepository.saveAndFlush(bundle);
            RoomAssignment ownerAssignment = roomAssignmentRepository.findActiveAssignment(currentUserId)
                    .orElse(null);
            return new CreateBundleResponse(FridgeDtoMapper.toResponse(saved, ownerAssignment));
        } catch (DataIntegrityViolationException ex) {
            if (isCapacityConstraintViolation(ex)) {
                throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "CAPACITY_EXCEEDED", ex);
            }
            throw ex;
        }
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

    private Optional<LabelSearchCriteria> parseLabelSearch(String rawKeyword) {
        if (!StringUtils.hasText(rawKeyword)) {
            return Optional.empty();
        }
        Matcher matcher = LABEL_SEARCH_PATTERN.matcher(rawKeyword.trim());
        if (!matcher.matches()) {
            return Optional.empty();
        }
        String letterPart = matcher.group(1).toUpperCase(Locale.ROOT);
        String numberPart = matcher.group(2);
        try {
            int slotIndex = LabelFormatter.fromSlotLetter(letterPart);
            int labelNumber = Integer.parseInt(numberPart);
            if (labelNumber <= 0 || labelNumber > MAX_LABEL) {
                return Optional.empty();
            }
            return Optional.of(new LabelSearchCriteria(slotIndex, labelNumber));
        } catch (IllegalArgumentException ex) {
            return Optional.empty();
        }
    }

    private List<Integer> extractSlotLetterCandidates(String rawKeyword) {
        if (!StringUtils.hasText(rawKeyword)) {
            return List.of();
        }
        Matcher matcher = SLOT_LETTER_TOKEN_PATTERN.matcher(rawKeyword);
        Set<Integer> indices = new LinkedHashSet<>();
        while (matcher.find()) {
            String token = matcher.group(1);
            try {
                int slotIndex = LabelFormatter.fromSlotLetter(token.toUpperCase(Locale.ROOT));
                indices.add(slotIndex);
            } catch (IllegalArgumentException ignored) {
                // 무시: 슬롯 코드 규칙에 맞지 않는 일반 단어
            }
        }
        return List.copyOf(indices);
    }

    private record LabelSearchCriteria(int slotIndex, int labelNumber) {
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

        if (allowFloorManager && isFloorManagerOnFloor(assignment, compartment.getFridgeUnit().getFloorNo())) {
            return;
        }

        List<CompartmentRoomAccess> accesses = compartmentRoomAccessRepository
                .findByFridgeCompartmentIdAndReleasedAtIsNullOrderByAssignedAtAsc(compartment.getId());
        boolean accessible = accesses.stream()
                .map(CompartmentRoomAccess::getRoom)
                .map(Room::getId)
                .anyMatch(roomId -> roomId.equals(requireRoomId(assignment)));
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

        List<Integer> recycled = new LinkedList<>(sequence.getRecycledNumbers());
        if (!recycled.isEmpty()) {
            recycled.sort(Integer::compareTo);
            int reused = recycled.removeFirst();
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

    private FridgeCompartment loadCompartmentForUpdate(UUID compartmentId) {
        return fridgeCompartmentRepository.findByIdForUpdate(compartmentId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "SLOT_NOT_FOUND"));
    }

    private boolean isCapacityConstraintViolation(DataIntegrityViolationException ex) {
        Throwable root = NestedExceptionUtils.getMostSpecificCause(ex);
        String message = root.getMessage();
        if (message == null) {
            return false;
        }
        return message.contains("uq_fridge_bundle_active_label")
                || message.contains("bundle_label_sequence")
                || message.contains("fridge_bundle_active_label");
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

package com.dormmate.backend.modules.inspection.application;

import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import com.dormmate.backend.modules.fridge.presentation.dto.FridgeBundleResponse;
import com.dormmate.backend.modules.fridge.presentation.dto.FridgeDtoMapper;
import com.dormmate.backend.modules.inspection.presentation.dto.InspectionActionEntryRequest;
import com.dormmate.backend.modules.inspection.presentation.dto.InspectionActionRequest;
import com.dormmate.backend.modules.inspection.presentation.dto.InspectionActionSummaryResponse;
import com.dormmate.backend.modules.inspection.presentation.dto.InspectionSessionResponse;
import com.dormmate.backend.modules.inspection.presentation.dto.StartInspectionRequest;
import com.dormmate.backend.modules.inspection.presentation.dto.SubmitInspectionRequest;
import com.dormmate.backend.modules.auth.domain.DormUser;
import com.dormmate.backend.modules.auth.domain.RoomAssignment;
import com.dormmate.backend.modules.fridge.domain.FridgeBundle;
import com.dormmate.backend.modules.fridge.domain.FridgeBundleStatus;
import com.dormmate.backend.modules.fridge.domain.FridgeCompartment;
import com.dormmate.backend.modules.fridge.domain.FridgeItem;
import com.dormmate.backend.modules.fridge.domain.FridgeItemStatus;
import com.dormmate.backend.modules.fridge.domain.LabelFormatter;
import com.dormmate.backend.modules.inspection.domain.InspectionAction;
import com.dormmate.backend.modules.inspection.domain.InspectionActionItem;
import com.dormmate.backend.modules.inspection.domain.InspectionActionType;
import com.dormmate.backend.modules.inspection.domain.InspectionParticipant;
import com.dormmate.backend.modules.inspection.domain.InspectionParticipantRole;
import com.dormmate.backend.modules.inspection.domain.InspectionSession;
import com.dormmate.backend.modules.inspection.domain.InspectionStatus;
import com.dormmate.backend.modules.auth.infrastructure.persistence.DormUserRepository;
import com.dormmate.backend.modules.auth.infrastructure.persistence.RoomAssignmentRepository;
import com.dormmate.backend.modules.fridge.infrastructure.persistence.FridgeBundleRepository;
import com.dormmate.backend.modules.fridge.infrastructure.persistence.FridgeCompartmentRepository;
import com.dormmate.backend.modules.fridge.infrastructure.persistence.FridgeItemRepository;
import com.dormmate.backend.modules.inspection.infrastructure.persistence.InspectionSessionRepository;
import com.dormmate.backend.modules.notification.application.NotificationService;
import com.dormmate.backend.global.security.SecurityUtils;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@Transactional
public class InspectionService {

    private final InspectionSessionRepository inspectionSessionRepository;
    private final FridgeCompartmentRepository fridgeCompartmentRepository;
    private final FridgeBundleRepository fridgeBundleRepository;
    private final FridgeItemRepository fridgeItemRepository;
    private final DormUserRepository dormUserRepository;
    private final RoomAssignmentRepository roomAssignmentRepository;
    private final NotificationService notificationService;
    private final Clock clock;

    public InspectionService(
            InspectionSessionRepository inspectionSessionRepository,
            FridgeCompartmentRepository fridgeCompartmentRepository,
            FridgeBundleRepository fridgeBundleRepository,
            FridgeItemRepository fridgeItemRepository,
            DormUserRepository dormUserRepository,
            RoomAssignmentRepository roomAssignmentRepository,
            NotificationService notificationService,
            Clock clock
    ) {
        this.inspectionSessionRepository = inspectionSessionRepository;
        this.fridgeCompartmentRepository = fridgeCompartmentRepository;
        this.fridgeBundleRepository = fridgeBundleRepository;
        this.fridgeItemRepository = fridgeItemRepository;
        this.dormUserRepository = dormUserRepository;
        this.roomAssignmentRepository = roomAssignmentRepository;
        this.notificationService = notificationService;
        this.clock = clock;
    }

    public InspectionSessionResponse startSession(StartInspectionRequest request) {
        ensureManagerRole();

        FridgeCompartment compartment = fridgeCompartmentRepository.findById(request.slotId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "SLOT_NOT_FOUND"));

        boolean alreadyActive = inspectionSessionRepository
                .findByFridgeCompartmentAndStatus(compartment, InspectionStatus.IN_PROGRESS)
                .stream()
                .findAny()
                .isPresent();
        if (alreadyActive) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "SESSION_ALREADY_ACTIVE");
        }

        DormUser currentUser = loadCurrentUser();
        OffsetDateTime now = OffsetDateTime.now(clock);

        InspectionSession session = new InspectionSession();
        session.setFridgeCompartment(compartment);
        session.setStartedBy(currentUser);
        session.setStatus(InspectionStatus.IN_PROGRESS);
        session.setStartedAt(now);

        compartment.setLocked(true);
        compartment.setLockedUntil(now.plusHours(2));

        InspectionParticipant participant = new InspectionParticipant();
        participant.setInspectionSession(session);
        participant.setDormUser(currentUser);
        participant.setRole(InspectionParticipantRole.LEAD);
        participant.setJoinedAt(now);
        session.getParticipants().add(participant);

        InspectionSession saved = inspectionSessionRepository.save(session);
        return mapSession(saved);
    }

    @Transactional(readOnly = true)
    public Optional<InspectionSessionResponse> findActiveSession(Integer floor) {
        List<InspectionSession> sessions = inspectionSessionRepository.findByStatus(InspectionStatus.IN_PROGRESS);
        sessions = sessions.stream()
                .filter(session -> floor == null
                        || session.getFridgeCompartment().getFridgeUnit().getFloorNo() == floor.shortValue())
                .sorted(Comparator.comparing(InspectionSession::getStartedAt))
                .toList();
        if (sessions.isEmpty()) {
            return Optional.empty();
        }
        return Optional.of(mapSession(sessions.getFirst()));
    }

    @Transactional(readOnly = true)
    public InspectionSessionResponse getSession(UUID sessionId) {
        InspectionSession session = inspectionSessionRepository.findById(sessionId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "SESSION_NOT_FOUND"));
        return mapSession(session);
    }

    public void cancelSession(UUID sessionId) {
        InspectionSession session = inspectionSessionRepository.findById(sessionId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "SESSION_NOT_FOUND"));
        ensureManagerRole();
        if (session.getStatus() != InspectionStatus.IN_PROGRESS) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "SESSION_NOT_ACTIVE");
        }
        OffsetDateTime now = OffsetDateTime.now(clock);
        session.setStatus(InspectionStatus.CANCELLED);
        session.setEndedAt(now);
        session.getFridgeCompartment().setLocked(false);
        session.getFridgeCompartment().setLockedUntil(null);
        inspectionSessionRepository.save(session);
    }

    public InspectionSessionResponse recordActions(UUID sessionId, InspectionActionRequest request) {
        InspectionSession session = inspectionSessionRepository.findById(sessionId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "SESSION_NOT_FOUND"));
        ensureManagerRole();
        if (session.getStatus() != InspectionStatus.IN_PROGRESS) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "SESSION_NOT_ACTIVE");
        }

        OffsetDateTime now = OffsetDateTime.now(clock);
        DormUser currentUser = loadCurrentUser();

        for (InspectionActionEntryRequest entry : request.actions()) {
            InspectionActionType actionType = parseAction(entry.action());
            FridgeBundle bundle = null;
            if (entry.bundleId() != null) {
                bundle = fridgeBundleRepository.findById(entry.bundleId())
                        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "BUNDLE_NOT_FOUND"));
                ensureBundleBelongsToSession(session, bundle);
            }

            FridgeItem item = null;
            if (entry.itemId() != null) {
                item = fridgeItemRepository.findById(entry.itemId())
                        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "ITEM_NOT_FOUND"));
                if (bundle != null && !item.getBundle().getId().equals(bundle.getId())) {
                    throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "ITEM_NOT_IN_BUNDLE");
                }
            }

            InspectionAction action = new InspectionAction();
            action.setInspectionSession(session);
            action.setFridgeBundle(bundle);
            action.setTargetUser(bundle != null ? bundle.getOwner() : null);
            action.setActionType(actionType);
            action.setReasonCode(actionType.name());
            action.setFreeNote(entry.note());
            action.setRecordedAt(now);
            action.setRecordedBy(currentUser);
            session.getActions().add(action);

            if (item != null) {
                InspectionActionItem actionItem = new InspectionActionItem();
                actionItem.setInspectionAction(action);
                actionItem.setFridgeItem(item);
                actionItem.setSnapshotName(item.getItemName());
                actionItem.setSnapshotExpiresOn(item.getExpiryDate());
                actionItem.setQuantityAtAction(item.getQuantity());
                action.getItems().add(actionItem);
            }

            if (actionType == InspectionActionType.DISPOSE_EXPIRED && item != null) {
                item.setStatus(FridgeItemStatus.DELETED);
                item.setDeletedAt(now);
                item.setUpdatedAfterInspection(true);
                fridgeItemRepository.save(item);
            }
        }

        inspectionSessionRepository.save(session);
        return mapSession(session);
    }

    public InspectionSessionResponse submitSession(UUID sessionId, SubmitInspectionRequest request) {
        InspectionSession session = inspectionSessionRepository.findById(sessionId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "SESSION_NOT_FOUND"));
        ensureManagerRole();
        if (session.getStatus() != InspectionStatus.IN_PROGRESS) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "SESSION_NOT_ACTIVE");
        }

        DormUser currentUser = loadCurrentUser();
        OffsetDateTime now = OffsetDateTime.now(clock);

        session.setStatus(InspectionStatus.SUBMITTED);
        session.setEndedAt(now);
        session.setSubmittedBy(currentUser);
        session.setSubmittedAt(now);
        session.setNotes(request != null ? request.notes() : null);
        session.setTotalBundleCount(fridgeBundleRepository
                .findByFridgeCompartmentAndStatus(session.getFridgeCompartment(), FridgeBundleStatus.ACTIVE).size());
        session.getFridgeCompartment().setLocked(false);
        session.getFridgeCompartment().setLockedUntil(null);

        InspectionSession saved = inspectionSessionRepository.save(session);
        notificationService.sendInspectionResultNotifications(saved);
        return mapSession(saved);
    }

    private void ensureManagerRole() {
        if (SecurityUtils.hasRole("ADMIN") || SecurityUtils.hasRole("FLOOR_MANAGER")) {
            return;
        }
        throw new ResponseStatusException(HttpStatus.FORBIDDEN, "FLOOR_MANAGER_ONLY");
    }

    private DormUser loadCurrentUser() {
        UUID userId = SecurityUtils.getCurrentUserId();
        return dormUserRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "USER_NOT_FOUND"));
    }

    private void ensureBundleBelongsToSession(InspectionSession session, FridgeBundle bundle) {
        UUID compartmentId = session.getFridgeCompartment().getId();
        if (!bundle.getFridgeCompartment().getId().equals(compartmentId)) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "BUNDLE_NOT_IN_COMPARTMENT");
        }
    }

    private InspectionActionType parseAction(String raw) {
        try {
            return InspectionActionType.valueOf(raw.trim().toUpperCase());
        } catch (IllegalArgumentException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "INVALID_ACTION");
        }
    }

    private InspectionSessionResponse mapSession(InspectionSession session) {
        FridgeCompartment compartment = session.getFridgeCompartment();
        List<FridgeBundle> bundles = fridgeBundleRepository
                .findByFridgeCompartmentAndStatus(compartment, FridgeBundleStatus.ACTIVE);

        Map<UUID, RoomAssignment> assignments = loadAssignmentsForBundles(bundles);
        List<FridgeBundleResponse> bundleResponses = bundles.stream()
                .sorted(Comparator.comparing(FridgeBundle::getCreatedAt).reversed())
                .map(bundle -> FridgeDtoMapper.toResponse(bundle, assignments.get(bundle.getOwner().getId())))
                .toList();

        List<InspectionActionSummaryResponse> summaries = buildSummary(session);

        int slotIndex = compartment.getSlotIndex();
        String slotLetter = LabelFormatter.toSlotLetter(slotIndex);
        int floorNo = compartment.getFridgeUnit().getFloorNo();
        String floorCode = floorNo + "F";

        return new InspectionSessionResponse(
                session.getId(),
                compartment.getId(),
                slotIndex,
                slotLetter,
                floorNo,
                floorCode,
                session.getStatus().name(),
                session.getStartedBy().getId(),
                session.getStartedAt(),
                session.getEndedAt(),
                bundleResponses,
                summaries,
                session.getNotes()
        );
    }

    private List<InspectionActionSummaryResponse> buildSummary(InspectionSession session) {
        EnumMap<InspectionActionType, Integer> counter = new EnumMap<>(InspectionActionType.class);
        for (InspectionAction action : session.getActions()) {
            counter.merge(action.getActionType(), 1, Integer::sum);
        }
        return counter.entrySet().stream()
                .map(entry -> new InspectionActionSummaryResponse(entry.getKey().name(), entry.getValue()))
                .sorted(Comparator.comparing(InspectionActionSummaryResponse::action))
                .toList();
    }

    private Map<UUID, RoomAssignment> loadAssignmentsForBundles(List<FridgeBundle> bundles) {
        Set<UUID> ownerIds = bundles.stream()
                .map(bundle -> bundle.getOwner().getId())
                .collect(Collectors.toSet());
        Map<UUID, RoomAssignment> result = new HashMap<>();
        for (UUID ownerId : ownerIds) {
            roomAssignmentRepository.findActiveAssignment(ownerId)
                    .ifPresent(assignment -> result.put(ownerId, assignment));
        }
        return result;
    }
}

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
import java.util.Objects;

import com.dormmate.backend.modules.audit.application.AuditLogService;
import com.dormmate.backend.modules.fridge.presentation.dto.FridgeBundleResponse;
import com.dormmate.backend.modules.fridge.presentation.dto.FridgeDtoMapper;
import com.dormmate.backend.modules.inspection.presentation.dto.InspectionActionDetailResponse;
import com.dormmate.backend.modules.inspection.presentation.dto.InspectionActionEntryRequest;
import com.dormmate.backend.modules.inspection.presentation.dto.InspectionActionItemResponse;
import com.dormmate.backend.modules.inspection.presentation.dto.InspectionActionRequest;
import com.dormmate.backend.modules.inspection.presentation.dto.InspectionActionSummaryResponse;
import com.dormmate.backend.modules.inspection.presentation.dto.InspectionSessionResponse;
import com.dormmate.backend.modules.inspection.presentation.dto.StartInspectionRequest;
import com.dormmate.backend.modules.inspection.presentation.dto.SubmitInspectionRequest;
import com.dormmate.backend.modules.auth.domain.DormUser;
import com.dormmate.backend.modules.auth.domain.Room;
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
import com.dormmate.backend.modules.fridge.infrastructure.persistence.CompartmentRoomAccessRepository;
import com.dormmate.backend.modules.fridge.infrastructure.persistence.FridgeBundleRepository;
import com.dormmate.backend.modules.fridge.infrastructure.persistence.FridgeCompartmentRepository;
import com.dormmate.backend.modules.fridge.infrastructure.persistence.FridgeItemRepository;
import com.dormmate.backend.modules.inspection.domain.InspectionSchedule;
import com.dormmate.backend.modules.inspection.domain.InspectionScheduleStatus;
import com.dormmate.backend.modules.inspection.infrastructure.persistence.InspectionScheduleRepository;
import com.dormmate.backend.modules.inspection.infrastructure.persistence.InspectionSessionRepository;
import com.dormmate.backend.modules.notification.application.NotificationService;
import com.dormmate.backend.modules.penalty.domain.PenaltyHistory;
import com.dormmate.backend.modules.inspection.presentation.dto.PenaltyHistoryResponse;
import com.dormmate.backend.global.security.SecurityUtils;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@Transactional
public class InspectionService {

    private static final String PENALTY_SOURCE = "FRIDGE_INSPECTION";
    private static final long LOCK_EXTENSION_MINUTES = 30L;

    private final InspectionSessionRepository inspectionSessionRepository;
    private final FridgeCompartmentRepository fridgeCompartmentRepository;
    private final FridgeBundleRepository fridgeBundleRepository;
    private final FridgeItemRepository fridgeItemRepository;
    private final DormUserRepository dormUserRepository;
    private final RoomAssignmentRepository roomAssignmentRepository;
    private final CompartmentRoomAccessRepository compartmentRoomAccessRepository;
    private final InspectionScheduleRepository inspectionScheduleRepository;
    private final NotificationService notificationService;
    private final AuditLogService auditLogService;
    private final Clock clock;

    public InspectionService(
            InspectionSessionRepository inspectionSessionRepository,
            FridgeCompartmentRepository fridgeCompartmentRepository,
            FridgeBundleRepository fridgeBundleRepository,
            FridgeItemRepository fridgeItemRepository,
            DormUserRepository dormUserRepository,
            RoomAssignmentRepository roomAssignmentRepository,
            CompartmentRoomAccessRepository compartmentRoomAccessRepository,
            InspectionScheduleRepository inspectionScheduleRepository,
            NotificationService notificationService,
            AuditLogService auditLogService,
            Clock clock
    ) {
        this.inspectionSessionRepository = inspectionSessionRepository;
        this.fridgeCompartmentRepository = fridgeCompartmentRepository;
        this.fridgeBundleRepository = fridgeBundleRepository;
        this.fridgeItemRepository = fridgeItemRepository;
        this.dormUserRepository = dormUserRepository;
        this.roomAssignmentRepository = roomAssignmentRepository;
        this.compartmentRoomAccessRepository = compartmentRoomAccessRepository;
        this.inspectionScheduleRepository = inspectionScheduleRepository;
        this.notificationService = notificationService;
        this.auditLogService = auditLogService;
        this.clock = clock;
    }

    private void extendCompartmentLock(FridgeCompartment compartment, OffsetDateTime baseline) {
        if (compartment == null) {
            return;
        }
        compartment.setLocked(true);
        compartment.setLockedUntil(baseline.plusMinutes(LOCK_EXTENSION_MINUTES));
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
        if (!SecurityUtils.hasRole("ADMIN")) {
            RoomAssignment assignment = roomAssignmentRepository.findActiveAssignment(currentUser.getId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN, "ROOM_ASSIGNMENT_REQUIRED"));
            short managedFloor = assignment.getRoom().getFloor();
            short compartmentFloor = compartment.getFridgeUnit().getFloorNo();
            if (managedFloor != compartmentFloor) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "FLOOR_SCOPE_VIOLATION");
            }
        }

        InspectionSchedule scheduleToLink = null;
        if (request.scheduleId() != null) {
            scheduleToLink = inspectionScheduleRepository.findById(request.scheduleId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "SCHEDULE_NOT_FOUND"));
            if (scheduleToLink.getStatus() != InspectionScheduleStatus.SCHEDULED) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "SCHEDULE_NOT_ACTIVE");
            }
            if (scheduleToLink.getInspectionSession() != null) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "SCHEDULE_ALREADY_LINKED");
            }
        }

        InspectionSession session = new InspectionSession();
        int initialBundleCount = fridgeBundleRepository
                .findByFridgeCompartmentAndStatus(compartment, FridgeBundleStatus.ACTIVE).size();
        session.setInitialBundleCount(initialBundleCount);
        session.setFridgeCompartment(compartment);
        session.setStartedBy(currentUser);
        session.setStatus(InspectionStatus.IN_PROGRESS);
        session.setStartedAt(now);

        extendCompartmentLock(compartment, now);

        InspectionParticipant participant = new InspectionParticipant();
        participant.setInspectionSession(session);
        participant.setDormUser(currentUser);
        participant.setRole(InspectionParticipantRole.LEAD);
        participant.setJoinedAt(now);
        session.getParticipants().add(participant);

        InspectionSession saved = inspectionSessionRepository.save(session);
        if (scheduleToLink != null) {
            scheduleToLink.setInspectionSession(saved);
            inspectionScheduleRepository.save(scheduleToLink);
        }
        return mapSession(saved, currentUser);
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
        DormUser currentUser = loadCurrentUser();
        for (InspectionSession session : sessions) {
            try {
                return Optional.of(mapSession(session, currentUser));
            } catch (ResponseStatusException ex) {
                if (ex.getStatusCode().value() == HttpStatus.FORBIDDEN.value()
                        && ("FORBIDDEN_SLOT".equals(ex.getReason()) || "FLOOR_SCOPE_VIOLATION".equals(ex.getReason()))) {
                    continue;
                }
                throw ex;
            }
        }
        return Optional.empty();
    }

    @Transactional(readOnly = true)
    public InspectionSessionResponse getSession(UUID sessionId) {
        InspectionSession session = inspectionSessionRepository.findById(sessionId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "SESSION_NOT_FOUND"));
        DormUser currentUser = loadCurrentUser();
        return mapSession(session, currentUser);
    }

    @Transactional(readOnly = true)
    public List<InspectionSessionResponse> listSessions(UUID slotId, String status, Integer limit) {
        DormUser currentUser = loadCurrentUser();
        final InspectionStatus statusFilter;
        if (status == null || status.isBlank()) {
            statusFilter = null;
        } else {
            try {
                statusFilter = InspectionStatus.valueOf(status.trim().toUpperCase());
            } catch (IllegalArgumentException ex) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "INVALID_STATUS");
            }
        }

        List<InspectionSession> sessions = inspectionSessionRepository.findAll().stream()
                .filter(session -> slotId == null || session.getFridgeCompartment().getId().equals(slotId))
                .filter(session -> statusFilter == null || session.getStatus() == statusFilter)
                .sorted(Comparator.comparing(InspectionSession::getStartedAt).reversed())
                .toList();

        List<InspectionSessionResponse> responses = new ArrayList<>();
        for (InspectionSession session : sessions) {
            try {
                responses.add(mapSession(session, currentUser));
            } catch (ResponseStatusException ex) {
                if (ex.getStatusCode().value() == HttpStatus.FORBIDDEN.value()
                        && ("FORBIDDEN_SLOT".equals(ex.getReason()) || "FLOOR_SCOPE_VIOLATION".equals(ex.getReason()))) {
                    continue;
                }
                throw ex;
            }
            if (limit != null && limit > 0 && responses.size() >= limit) {
                break;
            }
        }
        return responses;
    }

    public void cancelSession(UUID sessionId) {
        InspectionSession session = inspectionSessionRepository.findById(sessionId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "SESSION_NOT_FOUND"));
        ensureManagerOrAdmin();
        if (session.getStatus() != InspectionStatus.IN_PROGRESS) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "SESSION_NOT_ACTIVE");
        }
        DormUser actor = loadCurrentUser();
        OffsetDateTime now = OffsetDateTime.now(clock);
        session.setStatus(InspectionStatus.CANCELLED);
        session.setEndedAt(now);
        session.getFridgeCompartment().setLocked(false);
        session.getFridgeCompartment().setLockedUntil(null);
        inspectionSessionRepository.save(session);

        inspectionScheduleRepository.findByInspectionSessionId(session.getId()).ifPresent(schedule -> {
            schedule.setInspectionSession(null);
            schedule.setStatus(InspectionScheduleStatus.SCHEDULED);
            schedule.setCompletedAt(null);
            inspectionScheduleRepository.save(schedule);
        });

        auditLogService.record(new AuditLogService.AuditLogCommand(
                "INSPECTION_CANCEL",
                "INSPECTION_SESSION",
                session.getId().toString(),
                actor.getId(),
                null,
                Map.of(
                        "floor", session.getFridgeCompartment().getFridgeUnit().getFloorNo(),
                        "slotIndex", session.getFridgeCompartment().getSlotIndex(),
                        "reason", "MANUAL_CANCEL"
                )
        ));
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

        boolean extended = false;
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
            FridgeBundle itemBundle = item.getBundle();
            if (itemBundle == null) {
                throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "ITEM_NOT_IN_BUNDLE");
            }
            ensureBundleBelongsToSession(session, itemBundle);
            if (bundle != null && !itemBundle.getId().equals(bundle.getId())) {
                throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "ITEM_NOT_IN_BUNDLE");
            }
            if (bundle == null) {
                bundle = itemBundle;
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
            action.setCorrelationId(UUID.randomUUID());
            session.getActions().add(action);

            if (item != null) {
                InspectionActionItem actionItem = new InspectionActionItem();
                actionItem.setInspectionAction(action);
                actionItem.setFridgeItem(item);
                actionItem.setSnapshotName(item.getItemName());
                actionItem.setSnapshotExpiresOn(item.getExpiryDate());
                actionItem.setQuantityAtAction(item.getQuantity());
                actionItem.setCorrelationId(action.getCorrelationId());
                action.getItems().add(actionItem);

                item.setLastInspectedAt(now);
            }

            if (actionType == InspectionActionType.DISPOSE_EXPIRED && item != null) {
                item.setStatus(FridgeItemStatus.DELETED);
                item.setDeletedAt(now);
                fridgeItemRepository.save(item);
            }

            maybeAttachPenalty(action, actionType, currentUser, now);
            extended = true;
        }

        if (extended) {
            extendCompartmentLock(session.getFridgeCompartment(), now);
        }

        inspectionSessionRepository.save(session);
        return mapSession(session, currentUser);
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
        inspectionScheduleRepository.findByInspectionSessionId(saved.getId()).ifPresent(schedule -> {
            boolean updated = false;
            if (schedule.getStatus() != InspectionScheduleStatus.COMPLETED) {
                schedule.setStatus(InspectionScheduleStatus.COMPLETED);
                updated = true;
            }
            if (schedule.getCompletedAt() == null) {
                schedule.setCompletedAt(now);
                updated = true;
            }
            if (updated) {
                inspectionScheduleRepository.save(schedule);
            }
        });
        notificationService.sendInspectionResultNotifications(saved);

        auditLogService.record(new AuditLogService.AuditLogCommand(
                "INSPECTION_SUBMIT",
                "INSPECTION_SESSION",
                saved.getId().toString(),
                currentUser.getId(),
                null,
                Map.of(
                        "floor", saved.getFridgeCompartment().getFridgeUnit().getFloorNo(),
                        "slotIndex", saved.getFridgeCompartment().getSlotIndex(),
                        "status", saved.getStatus().name(),
                        "totalBundles", saved.getTotalBundleCount()
                )
        ));

        return mapSession(saved, currentUser);
    }

    public int releaseExpiredSessions() {
        OffsetDateTime now = OffsetDateTime.now(clock);
        List<FridgeCompartment> expiredCompartments = fridgeCompartmentRepository.findExpiredLocks(now);
        int released = 0;

        for (FridgeCompartment compartment : expiredCompartments) {
            List<InspectionSession> sessions =
                    inspectionSessionRepository.findByFridgeCompartmentAndStatus(compartment, InspectionStatus.IN_PROGRESS);

            for (InspectionSession session : sessions) {
                session.setStatus(InspectionStatus.CANCELLED);
                session.setEndedAt(now);
                inspectionScheduleRepository.findByInspectionSessionId(session.getId()).ifPresent(schedule -> {
                    schedule.setInspectionSession(null);
                    schedule.setStatus(InspectionScheduleStatus.SCHEDULED);
                    schedule.setCompletedAt(null);
                    inspectionScheduleRepository.save(schedule);
                });
                released++;
            }

            compartment.setLocked(false);
            compartment.setLockedUntil(null);
        }

        return released;
    }

    private void ensureManagerRole() {
        if (SecurityUtils.hasRole("FLOOR_MANAGER")) {
            return;
        }
        throw new ResponseStatusException(HttpStatus.FORBIDDEN, "FLOOR_MANAGER_ONLY");
    }

    private void ensureManagerOrAdmin() {
        if (SecurityUtils.hasRole("FLOOR_MANAGER") || SecurityUtils.hasRole("ADMIN")) {
            return;
        }
        throw new ResponseStatusException(HttpStatus.FORBIDDEN, "FLOOR_MANAGER_OR_ADMIN_ONLY");
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

    private InspectionSessionResponse mapSession(InspectionSession session, DormUser viewer) {
        ensureViewerCanAccessSession(viewer, session);
        FridgeCompartment compartment = session.getFridgeCompartment();
        List<FridgeBundle> bundles = fridgeBundleRepository
                .findByFridgeCompartmentAndStatus(compartment, FridgeBundleStatus.ACTIVE);

        Map<UUID, RoomAssignment> assignments = loadAssignmentsForBundles(bundles);
        UUID viewerId = viewer.getId();
        List<FridgeBundleResponse> bundleResponses = bundles.stream()
                .sorted(Comparator.comparing(FridgeBundle::getCreatedAt).reversed())
                .map(bundle -> FridgeDtoMapper.toResponse(
                        bundle,
                        assignments.get(bundle.getOwner().getId()),
                        bundle.getOwner().getId().equals(viewerId)
                ))
                .toList();

        List<InspectionActionSummaryResponse> summaries = buildSummary(session);

        List<InspectionActionDetailResponse> actionDetails = session.getActions().stream()
                .sorted(Comparator.comparing(InspectionAction::getRecordedAt))
                .map(action -> {
                    List<InspectionActionItemResponse> itemResponses = action.getItems().stream()
                            .map(item -> new InspectionActionItemResponse(
                                    item.getId(),
                                    item.getFridgeItem() != null ? item.getFridgeItem().getId() : null,
                                    item.getSnapshotName(),
                                    item.getSnapshotExpiresOn(),
                                    item.getQuantityAtAction(),
                                    item.getCorrelationId()
                            ))
                            .toList();
                    List<PenaltyHistoryResponse> penaltyResponses = action.getPenalties().stream()
                            .map(penalty -> new PenaltyHistoryResponse(
                                    penalty.getId(),
                                    penalty.getPoints(),
                                    penalty.getReason(),
                                    penalty.getIssuedAt(),
                                    penalty.getExpiresAt(),
                                    penalty.getCorrelationId()
                            ))
                            .toList();
                    return new InspectionActionDetailResponse(
                            action.getId(),
                            action.getActionType().name(),
                            action.getFridgeBundle() != null ? action.getFridgeBundle().getId() : null,
                            action.getTargetUser() != null ? action.getTargetUser().getId() : null,
                            action.getRecordedAt(),
                            action.getRecordedBy() != null ? action.getRecordedBy().getId() : null,
                            action.getFreeNote(),
                            action.getCorrelationId(),
                            itemResponses,
                            penaltyResponses
                    );
                })
                .toList();

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
                actionDetails,
                session.getNotes(),
                session.getInitialBundleCount(),
                session.getTotalBundleCount()
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

    private void maybeAttachPenalty(InspectionAction action, InspectionActionType type, DormUser issuer, OffsetDateTime issuedAt) {
        DormUser target = action.getTargetUser();
        if (target == null) {
            return;
        }
        int points = switch (type) {
            case DISPOSE_EXPIRED, UNREGISTERED_DISPOSE -> 1;
            default -> 0;
        };
        if (points <= 0) {
            return;
        }
        PenaltyHistory penalty = new PenaltyHistory();
        penalty.setUser(target);
        penalty.setIssuer(issuer);
        penalty.setSource(PENALTY_SOURCE);
        penalty.setPoints(points);
        penalty.setReason(type.name());
        penalty.setIssuedAt(issuedAt);
        penalty.setInspectionAction(action);
        penalty.setCorrelationId(action.getCorrelationId());
        action.getPenalties().add(penalty);
    }

    private void ensureViewerCanAccessSession(DormUser viewer, InspectionSession session) {
        if (SecurityUtils.hasRole("ADMIN")) {
            return;
        }
        RoomAssignment assignment = roomAssignmentRepository.findActiveAssignment(viewer.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN, "ROOM_ASSIGNMENT_REQUIRED"));
        Room assignedRoom = requireRoom(assignment);

        short sessionFloor = session.getFridgeCompartment().getFridgeUnit().getFloorNo();
        if (SecurityUtils.hasRole("FLOOR_MANAGER")) {
            if (assignedRoom.getFloor() != sessionFloor) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "FLOOR_SCOPE_VIOLATION");
            }
            return;
        }

        UUID viewerRoomId = requireRoomId(assignment);
        boolean accessible = compartmentRoomAccessRepository
                .findByFridgeCompartmentIdAndReleasedAtIsNullOrderByAssignedAtAsc(session.getFridgeCompartment().getId())
                .stream()
                .anyMatch(access -> access.getRoom().getId().equals(viewerRoomId));
        if (!accessible) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "FORBIDDEN_SLOT");
        }
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

    private Room requireRoom(RoomAssignment assignment) {
        return Objects.requireNonNull(assignment.getRoom(), "room assignment missing room");
    }

    private UUID requireRoomId(RoomAssignment assignment) {
        Room room = requireRoom(assignment);
        return Objects.requireNonNull(room.getId(), "room id");
    }
}

package com.dormmate.backend.modules.inspection.application;

import java.time.Clock;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import com.dormmate.backend.modules.auth.domain.DormUser;
import com.dormmate.backend.modules.auth.domain.DormUserStatus;
import com.dormmate.backend.modules.auth.domain.RoomAssignment;
import com.dormmate.backend.modules.auth.infrastructure.persistence.RoomAssignmentRepository;
import com.dormmate.backend.modules.fridge.domain.CompartmentRoomAccess;
import com.dormmate.backend.modules.fridge.domain.FridgeCompartment;
import com.dormmate.backend.modules.fridge.domain.LabelFormatter;
import com.dormmate.backend.modules.fridge.infrastructure.persistence.CompartmentRoomAccessRepository;
import com.dormmate.backend.modules.fridge.infrastructure.persistence.FridgeCompartmentRepository;
import com.dormmate.backend.modules.inspection.domain.InspectionSchedule;
import com.dormmate.backend.modules.inspection.domain.InspectionScheduleStatus;
import com.dormmate.backend.modules.inspection.domain.InspectionSession;
import com.dormmate.backend.modules.inspection.infrastructure.persistence.InspectionScheduleRepository;
import com.dormmate.backend.modules.inspection.infrastructure.persistence.InspectionSessionRepository;
import com.dormmate.backend.modules.inspection.presentation.dto.CreateInspectionScheduleRequest;
import com.dormmate.backend.modules.inspection.presentation.dto.InspectionScheduleResponse;
import com.dormmate.backend.modules.inspection.presentation.dto.UpdateInspectionScheduleRequest;
import com.dormmate.backend.modules.notification.application.NotificationService;
import com.dormmate.backend.global.security.SecurityUtils;

import org.springframework.core.NestedExceptionUtils;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@Transactional
public class InspectionScheduleService {

    private static final DateTimeFormatter SCHEDULE_TIME_FORMAT =
            DateTimeFormatter.ofPattern("M월 d일 a h시 m분", Locale.KOREAN);
    private static final Set<InspectionScheduleStatus> ACTIVE_STATUSES =
            EnumSet.of(InspectionScheduleStatus.SCHEDULED);
    private static final String SCHEDULE_DEDUPE_PREFIX = "FRIDGE_SCHEDULE:";

    private final InspectionScheduleRepository inspectionScheduleRepository;
    private final InspectionSessionRepository inspectionSessionRepository;
    private final RoomAssignmentRepository roomAssignmentRepository;
    private final Clock clock;
    private final FridgeCompartmentRepository fridgeCompartmentRepository;
    private final CompartmentRoomAccessRepository compartmentRoomAccessRepository;
    private final NotificationService notificationService;

    public InspectionScheduleService(
            InspectionScheduleRepository inspectionScheduleRepository,
            InspectionSessionRepository inspectionSessionRepository,
            RoomAssignmentRepository roomAssignmentRepository,
            Clock clock,
            FridgeCompartmentRepository fridgeCompartmentRepository,
            CompartmentRoomAccessRepository compartmentRoomAccessRepository,
            NotificationService notificationService
    ) {
        this.inspectionScheduleRepository = inspectionScheduleRepository;
        this.inspectionSessionRepository = inspectionSessionRepository;
        this.roomAssignmentRepository = roomAssignmentRepository;
        this.clock = clock;
        this.fridgeCompartmentRepository = fridgeCompartmentRepository;
        this.compartmentRoomAccessRepository = compartmentRoomAccessRepository;
        this.notificationService = notificationService;
    }

    @Transactional(readOnly = true)
    public List<InspectionScheduleResponse> listSchedules(String status, Integer limit) {
        InspectionScheduleStatus statusFilter = parseStatus(status, true);
        List<InspectionSchedule> schedules;
        if (statusFilter != null) {
            schedules = inspectionScheduleRepository.findByStatusOrderByScheduledAtAsc(statusFilter);
        } else {
            schedules = inspectionScheduleRepository.findAll().stream()
                    .sorted(Comparator.comparing(InspectionSchedule::getScheduledAt))
                    .toList();
        }

        if (limit != null && limit > 0 && schedules.size() > limit) {
            schedules = schedules.subList(0, limit);
        }

        return schedules.stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public Optional<InspectionScheduleResponse> getNextSchedule() {
        OffsetDateTime now = OffsetDateTime.now(clock);
        return inspectionScheduleRepository
                .findTopByStatusAndScheduledAtGreaterThanEqualOrderByScheduledAtAsc(
                        InspectionScheduleStatus.SCHEDULED,
                        now
                )
                .map(this::toResponse);
    }

    public InspectionScheduleResponse createSchedule(CreateInspectionScheduleRequest request) {
        ensureManagerRole();
        FridgeCompartment compartment = loadCompartmentForManager(request.fridgeCompartmentId());
        ensureNoScheduleConflict(compartment.getId(), request.scheduledAt(), null);

        InspectionSchedule schedule = new InspectionSchedule();
        schedule.setScheduledAt(request.scheduledAt());
        schedule.setTitle(trimToNull(request.title()));
        schedule.setNotes(trimToNull(request.notes()));
        schedule.setStatus(InspectionScheduleStatus.SCHEDULED);
        schedule.setFridgeCompartment(compartment);

        InspectionSchedule saved = saveSchedule(schedule);
        notifyResidentsOfSchedule(saved, compartment);
        return toResponse(saved);
    }

    public InspectionScheduleResponse updateSchedule(UUID scheduleId, UpdateInspectionScheduleRequest request) {
        ensureManagerRole();
        InspectionSchedule schedule = inspectionScheduleRepository.findById(scheduleId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "SCHEDULE_NOT_FOUND"));

        if (request.scheduledAt() != null) {
            schedule.setScheduledAt(request.scheduledAt());
        }
        if (request.title() != null) {
            schedule.setTitle(trimToNull(request.title()));
        }
        if (request.notes() != null) {
            schedule.setNotes(trimToNull(request.notes()));
        }
        if (request.status() != null) {
            InspectionScheduleStatus newStatus = parseStatus(request.status(), false);
            schedule.setStatus(newStatus);
        }
        if (request.completedAt() != null || request.status() != null) {
            schedule.setCompletedAt(request.completedAt());
            if (request.status() != null) {
                InspectionScheduleStatus status = schedule.getStatus();
                if (status == InspectionScheduleStatus.COMPLETED && schedule.getCompletedAt() == null) {
                    schedule.setCompletedAt(OffsetDateTime.now(clock));
                }
                if (status == InspectionScheduleStatus.SCHEDULED) {
                    schedule.setCompletedAt(null);
                }
            }
        }
        if (request.inspectionSessionId() != null) {
            InspectionSession session = inspectionSessionRepository.findById(request.inspectionSessionId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "SESSION_NOT_FOUND"));
            schedule.setInspectionSession(session);
        } else if (request.detachInspectionSession()) {
            schedule.setInspectionSession(null);
        }

        if (request.fridgeCompartmentId() != null) {
            FridgeCompartment compartment = loadCompartmentForManager(request.fridgeCompartmentId());
            schedule.setFridgeCompartment(compartment);
        } else {
            ensureAssignedCompartmentAccessible(schedule);
        }

        if (schedule.getStatus() == InspectionScheduleStatus.SCHEDULED) {
            ensureNoScheduleConflict(
                    schedule.getFridgeCompartment().getId(),
                    schedule.getScheduledAt(),
                    schedule.getId()
            );
        }

        InspectionSchedule saved = saveSchedule(schedule);
        return toResponse(saved);
    }

    public void deleteSchedule(UUID scheduleId) {
        ensureManagerRole();
        InspectionSchedule schedule = inspectionScheduleRepository.findById(scheduleId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "SCHEDULE_NOT_FOUND"));
        inspectionScheduleRepository.delete(schedule);
    }

    private InspectionScheduleStatus parseStatus(String raw, boolean allowNull) {
        if (raw == null) {
            if (allowNull) {
                return null;
            }
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "STATUS_REQUIRED");
        }
        try {
            return InspectionScheduleStatus.valueOf(raw.trim().toUpperCase());
        } catch (IllegalArgumentException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "INVALID_STATUS");
        }
    }

    private String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private InspectionScheduleResponse toResponse(InspectionSchedule schedule) {
        UUID sessionId = schedule.getInspectionSession() != null ? schedule.getInspectionSession().getId() : null;
        FridgeCompartment compartment = schedule.getFridgeCompartment();
        UUID compartmentId = compartment != null ? compartment.getId() : null;
        Integer slotIndex = compartment != null ? compartment.getSlotIndex() : null;
        String slotLetter = compartment != null ? LabelFormatter.toSlotLetter(compartment.getSlotIndex()) : null;
        Integer floorNo = null;
        String floorCode = null;
        if (compartment != null) {
            int floorValue = compartment.getFridgeUnit().getFloorNo();
            floorNo = floorValue;
            floorCode = floorValue + "F";
        }
        return new InspectionScheduleResponse(
                schedule.getId(),
                schedule.getScheduledAt(),
                schedule.getTitle(),
                schedule.getNotes(),
                schedule.getStatus().name(),
                schedule.getCompletedAt(),
                sessionId,
                compartmentId,
                slotIndex,
                slotLetter,
                floorNo,
                floorCode,
                schedule.getCreatedAt(),
                schedule.getUpdatedAt()
        );
    }

    private void ensureNoScheduleConflict(UUID compartmentId, OffsetDateTime scheduledAt, UUID excludeId) {
        boolean exists = excludeId == null
                ? inspectionScheduleRepository.existsByFridgeCompartment_IdAndStatusInAndScheduledAt(
                compartmentId, ACTIVE_STATUSES, scheduledAt)
                : inspectionScheduleRepository.existsByFridgeCompartment_IdAndStatusInAndScheduledAtAndIdNot(
                compartmentId, ACTIVE_STATUSES, scheduledAt, excludeId);
        if (exists) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "SCHEDULE_CONFLICT");
        }
    }

    private InspectionSchedule saveSchedule(InspectionSchedule schedule) {
        try {
            return inspectionScheduleRepository.save(schedule);
        } catch (DataIntegrityViolationException ex) {
            if (isScheduleConflictViolation(ex)) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "SCHEDULE_CONFLICT", ex);
            }
            throw ex;
        }
    }

    private boolean isScheduleConflictViolation(DataIntegrityViolationException ex) {
        Throwable root = NestedExceptionUtils.getMostSpecificCause(ex);
        String message = root.getMessage();
        return message != null && message.contains("uq_inspection_schedule_active_compartment_scheduled_at");
    }

    private void notifyResidentsOfSchedule(InspectionSchedule schedule, FridgeCompartment compartment) {
        List<CompartmentRoomAccess> accesses = compartmentRoomAccessRepository
                .findByFridgeCompartmentIdAndReleasedAtIsNullOrderByAssignedAtAsc(compartment.getId());
        if (accesses.isEmpty()) {
            return;
        }

        OffsetDateTime scheduledAt = schedule.getScheduledAt();
        String slotLetter = LabelFormatter.toSlotLetter(compartment.getSlotIndex());
        int floorNo = compartment.getFridgeUnit().getFloorNo();
        String floorCode = floorNo + "F";
        String slotDisplay = floorCode + " " + slotLetter + "칸";
        String scheduledDisplay = scheduledAt.atZoneSameInstant(clock.getZone()).format(SCHEDULE_TIME_FORMAT);
        String title = "[냉장고] 검사 일정 안내";
        String body = "%s 검사가 %s에 예정돼 있습니다. 지정 시간 전후로 물품을 정리해 주세요."
                .formatted(slotDisplay, scheduledDisplay);

        Map<String, Object> metadata = new LinkedHashMap<>();
        metadata.put("scheduleId", schedule.getId());
        metadata.put("scheduledAt", scheduledAt);
        metadata.put("fridgeCompartmentId", compartment.getId());
        metadata.put("slotIndex", compartment.getSlotIndex());
        metadata.put("slotLetter", slotLetter);
        metadata.put("floorNo", floorNo);
        metadata.put("floorCode", floorCode);

        Set<UUID> notified = new LinkedHashSet<>();
        for (CompartmentRoomAccess access : accesses) {
            List<RoomAssignment> assignments = roomAssignmentRepository
                    .findActiveAssignmentsByRoom(access.getRoom().getId());
            for (RoomAssignment assignment : assignments) {
                DormUser resident = assignment.getDormUser();
                if (resident == null || resident.getStatus() != DormUserStatus.ACTIVE) {
                    continue;
                }
                UUID userId = resident.getId();
                if (!notified.add(userId)) {
                    continue;
                }
                String dedupeKey = SCHEDULE_DEDUPE_PREFIX + schedule.getId() + ":" + userId;
                notificationService.sendNotification(
                        userId,
                        NotificationService.KIND_FRIDGE_SCHEDULE,
                        title,
                        body,
                        dedupeKey,
                        metadata,
                        NotificationService.DEFAULT_SCHEDULE_TTL_HOURS,
                        schedule.getId()
                );
            }
        }
    }

    private void ensureManagerRole() {
        if (SecurityUtils.hasRole("FLOOR_MANAGER")) {
            return;
        }
        throw new ResponseStatusException(HttpStatus.FORBIDDEN, "FLOOR_MANAGER_ONLY");
    }

    private FridgeCompartment loadCompartmentForManager(UUID compartmentId) {
        if (compartmentId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "COMPARTMENT_REQUIRED");
        }
        FridgeCompartment compartment = fridgeCompartmentRepository.findById(compartmentId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "SLOT_NOT_FOUND"));
        ensureManagerAssignmentOnFloor(compartment);
        if (!compartment.getStatus().isActive()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "COMPARTMENT_INACTIVE");
        }
        return compartment;
    }

    private void ensureAssignedCompartmentAccessible(InspectionSchedule schedule) {
        FridgeCompartment compartment = schedule.getFridgeCompartment();
        if (compartment == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "COMPARTMENT_REQUIRED");
        }
        ensureManagerAssignmentOnFloor(compartment);
    }

    private void ensureManagerAssignmentOnFloor(FridgeCompartment compartment) {
        UUID userId = SecurityUtils.getCurrentUserId();
        Optional<RoomAssignment> assignmentOpt = roomAssignmentRepository.findActiveAssignment(userId);
        if (assignmentOpt.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "ROOM_ASSIGNMENT_REQUIRED");
        }
        RoomAssignment assignment = assignmentOpt.get();
        short managerFloor = assignment.getRoom().getFloor();
        short compartmentFloor = compartment.getFridgeUnit().getFloorNo();
        if (managerFloor != compartmentFloor) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "FLOOR_SCOPE_VIOLATION");
        }
    }
}

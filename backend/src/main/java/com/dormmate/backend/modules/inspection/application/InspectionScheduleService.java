package com.dormmate.backend.modules.inspection.application;

import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.dormmate.backend.modules.inspection.domain.InspectionSchedule;
import com.dormmate.backend.modules.inspection.domain.InspectionScheduleStatus;
import com.dormmate.backend.modules.inspection.infrastructure.persistence.InspectionScheduleRepository;
import com.dormmate.backend.modules.inspection.infrastructure.persistence.InspectionSessionRepository;
import com.dormmate.backend.modules.inspection.presentation.dto.CreateInspectionScheduleRequest;
import com.dormmate.backend.modules.inspection.presentation.dto.InspectionScheduleResponse;
import com.dormmate.backend.modules.inspection.presentation.dto.UpdateInspectionScheduleRequest;
import com.dormmate.backend.modules.inspection.domain.InspectionSession;
import com.dormmate.backend.global.security.SecurityUtils;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@Transactional
public class InspectionScheduleService {

    private final InspectionScheduleRepository inspectionScheduleRepository;
    private final InspectionSessionRepository inspectionSessionRepository;
    private final Clock clock;

    public InspectionScheduleService(
            InspectionScheduleRepository inspectionScheduleRepository,
            InspectionSessionRepository inspectionSessionRepository,
            Clock clock
    ) {
        this.inspectionScheduleRepository = inspectionScheduleRepository;
        this.inspectionSessionRepository = inspectionSessionRepository;
        this.clock = clock;
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
        InspectionSchedule schedule = new InspectionSchedule();
        schedule.setScheduledAt(request.scheduledAt());
        schedule.setTitle(trimToNull(request.title()));
        schedule.setNotes(trimToNull(request.notes()));
        schedule.setStatus(InspectionScheduleStatus.SCHEDULED);
        InspectionSchedule saved = inspectionScheduleRepository.save(schedule);
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

        InspectionSchedule saved = inspectionScheduleRepository.save(schedule);
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
        return new InspectionScheduleResponse(
                schedule.getId(),
                schedule.getScheduledAt(),
                schedule.getTitle(),
                schedule.getNotes(),
                schedule.getStatus().name(),
                schedule.getCompletedAt(),
                sessionId,
                schedule.getCreatedAt(),
                schedule.getUpdatedAt()
        );
    }

    private void ensureManagerRole() {
        if (SecurityUtils.hasRole("FLOOR_MANAGER")) {
            return;
        }
        throw new ResponseStatusException(HttpStatus.FORBIDDEN, "FLOOR_MANAGER_ONLY");
    }
}

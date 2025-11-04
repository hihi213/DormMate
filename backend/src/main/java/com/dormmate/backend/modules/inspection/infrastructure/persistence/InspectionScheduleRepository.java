package com.dormmate.backend.modules.inspection.infrastructure.persistence;

import java.time.OffsetDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.dormmate.backend.modules.inspection.domain.InspectionSchedule;
import com.dormmate.backend.modules.inspection.domain.InspectionScheduleStatus;

import org.springframework.data.jpa.repository.JpaRepository;

public interface InspectionScheduleRepository extends JpaRepository<InspectionSchedule, UUID> {

    List<InspectionSchedule> findByStatusOrderByScheduledAtAsc(InspectionScheduleStatus status);

    Optional<InspectionSchedule> findTopByStatusAndScheduledAtGreaterThanEqualOrderByScheduledAtAsc(
            InspectionScheduleStatus status,
            OffsetDateTime scheduledAt
    );

    boolean existsByFridgeCompartment_IdAndStatusInAndScheduledAt(
            UUID fridgeCompartmentId,
            Collection<InspectionScheduleStatus> statuses,
            OffsetDateTime scheduledAt
    );

    boolean existsByFridgeCompartment_IdAndStatusInAndScheduledAtAndIdNot(
            UUID fridgeCompartmentId,
            Collection<InspectionScheduleStatus> statuses,
            OffsetDateTime scheduledAt,
            UUID scheduleId
    );

    Optional<InspectionSchedule> findByInspectionSessionId(UUID inspectionSessionId);

    List<InspectionSchedule> findTop5ByOrderByCreatedAtDesc();

    List<InspectionSchedule> findByScheduledAtBetween(OffsetDateTime startInclusive, OffsetDateTime endInclusive);
}

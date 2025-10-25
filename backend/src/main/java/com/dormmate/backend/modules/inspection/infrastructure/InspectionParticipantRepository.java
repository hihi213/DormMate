package com.dormmate.backend.modules.inspection.infrastructure;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.dormmate.backend.modules.inspection.domain.InspectionParticipant;
import com.dormmate.backend.modules.inspection.domain.InspectionSession;

public interface InspectionParticipantRepository extends JpaRepository<InspectionParticipant, Long> {

    List<InspectionParticipant> findByInspectionSession(InspectionSession session);
}

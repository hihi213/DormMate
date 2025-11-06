package com.dormmate.backend.modules.inspection.infrastructure.persistence;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.dormmate.backend.modules.inspection.domain.InspectionAction;
import com.dormmate.backend.modules.inspection.domain.InspectionSession;

public interface InspectionActionRepository extends JpaRepository<InspectionAction, Long> {

    List<InspectionAction> findByInspectionSession(InspectionSession session);
}

package com.dormmate.backend.modules.inspection.infrastructure.persistence;

import java.util.List;

import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.dormmate.backend.modules.inspection.domain.InspectionSession;
import com.dormmate.backend.modules.inspection.domain.InspectionStatus;
import com.dormmate.backend.modules.fridge.domain.FridgeCompartment;

public interface InspectionSessionRepository extends JpaRepository<InspectionSession, UUID> {

    List<InspectionSession> findByFridgeCompartmentAndStatus(FridgeCompartment compartment, InspectionStatus status);

    List<InspectionSession> findByStatus(InspectionStatus status);
}

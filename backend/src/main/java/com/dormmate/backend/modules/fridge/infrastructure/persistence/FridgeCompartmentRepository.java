package com.dormmate.backend.modules.fridge.infrastructure.persistence;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.dormmate.backend.modules.fridge.domain.FridgeCompartment;
import com.dormmate.backend.modules.fridge.domain.FridgeUnit;

public interface FridgeCompartmentRepository extends JpaRepository<FridgeCompartment, UUID> {

    List<FridgeCompartment> findByFridgeUnitOrderBySlotIndexAsc(FridgeUnit unit);
}

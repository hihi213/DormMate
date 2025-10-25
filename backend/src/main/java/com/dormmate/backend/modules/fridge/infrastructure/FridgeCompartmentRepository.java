package com.dormmate.backend.modules.fridge.infrastructure;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.dormmate.backend.modules.fridge.domain.FridgeCompartment;
import com.dormmate.backend.modules.fridge.domain.FridgeUnit;

public interface FridgeCompartmentRepository extends JpaRepository<FridgeCompartment, UUID> {

    List<FridgeCompartment> findByFridgeUnitOrderByDisplayOrder(FridgeUnit unit);

    Optional<FridgeCompartment> findBySlotCode(String slotCode);
}

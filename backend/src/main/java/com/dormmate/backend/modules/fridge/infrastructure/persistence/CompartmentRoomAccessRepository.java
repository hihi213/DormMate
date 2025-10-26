package com.dormmate.backend.modules.fridge.infrastructure.persistence;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.dormmate.backend.modules.fridge.domain.CompartmentRoomAccess;
import com.dormmate.backend.modules.fridge.domain.FridgeCompartment;

public interface CompartmentRoomAccessRepository extends JpaRepository<CompartmentRoomAccess, UUID> {

    List<CompartmentRoomAccess> findByFridgeCompartmentAndReleasedAtIsNullOrderByPriorityOrderAsc(
            FridgeCompartment compartment);

    List<CompartmentRoomAccess> findByRoomIdAndReleasedAtIsNull(UUID roomId);
}

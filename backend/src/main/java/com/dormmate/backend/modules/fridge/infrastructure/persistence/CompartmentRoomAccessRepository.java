package com.dormmate.backend.modules.fridge.infrastructure.persistence;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.dormmate.backend.modules.fridge.domain.CompartmentRoomAccess;
public interface CompartmentRoomAccessRepository extends JpaRepository<CompartmentRoomAccess, UUID> {

    List<CompartmentRoomAccess> findByFridgeCompartmentIdAndReleasedAtIsNullOrderByAssignedAtAsc(UUID compartmentId);

    List<CompartmentRoomAccess> findByRoomIdAndReleasedAtIsNull(UUID roomId);
}

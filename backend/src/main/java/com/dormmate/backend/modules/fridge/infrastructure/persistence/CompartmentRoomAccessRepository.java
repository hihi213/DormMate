package com.dormmate.backend.modules.fridge.infrastructure.persistence;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.dormmate.backend.modules.fridge.domain.CompartmentRoomAccess;

public interface CompartmentRoomAccessRepository extends JpaRepository<CompartmentRoomAccess, UUID> {

    List<CompartmentRoomAccess> findByFridgeCompartmentIdAndReleasedAtIsNullOrderByAssignedAtAsc(UUID compartmentId);

    List<CompartmentRoomAccess> findByRoomIdAndReleasedAtIsNull(UUID roomId);

    @Query("""
            select cra
              from CompartmentRoomAccess cra
              join fetch cra.room
             where cra.releasedAt is null
               and cra.fridgeCompartment.id in :compartmentIds
            """)
    List<CompartmentRoomAccess> findActiveAccessesByCompartmentIds(@Param("compartmentIds") List<UUID> compartmentIds);
}

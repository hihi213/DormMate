package com.dormmate.backend.modules.fridge.infrastructure.persistence;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import jakarta.persistence.LockModeType;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.dormmate.backend.modules.fridge.domain.FridgeCompartment;
import com.dormmate.backend.modules.fridge.domain.FridgeUnit;

public interface FridgeCompartmentRepository extends JpaRepository<FridgeCompartment, UUID> {

    List<FridgeCompartment> findByFridgeUnitOrderBySlotIndexAsc(FridgeUnit unit);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from FridgeCompartment c where c.id = :id")
    Optional<FridgeCompartment> findByIdForUpdate(@Param("id") UUID id);

    @Query("""
            select c from FridgeCompartment c
            left join fetch c.fridgeUnit u
            where u.status = com.dormmate.backend.global.common.ResourceStatus.ACTIVE
            """)
    List<FridgeCompartment> findAllWithActiveUnit();

    @Query("""
            select distinct c
              from FridgeCompartment c
              join fetch c.fridgeUnit u
              left join fetch c.roomAccesses cra
              left join fetch cra.room r
             where u.floorNo = :floor
            """)
    List<FridgeCompartment> findByFloorWithAccesses(@Param("floor") short floor);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from FridgeCompartment c join fetch c.fridgeUnit u where c.id in :ids")
    List<FridgeCompartment> findByIdInForUpdate(@Param("ids") List<UUID> ids);
}

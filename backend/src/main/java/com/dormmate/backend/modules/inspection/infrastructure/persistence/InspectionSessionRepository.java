package com.dormmate.backend.modules.inspection.infrastructure.persistence;

import java.util.List;
import java.util.Set;
import java.util.UUID;

import com.dormmate.backend.modules.fridge.domain.FridgeCompartment;
import com.dormmate.backend.modules.inspection.domain.InspectionSession;
import com.dormmate.backend.modules.inspection.domain.InspectionStatus;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface InspectionSessionRepository extends JpaRepository<InspectionSession, UUID> {

    List<InspectionSession> findByFridgeCompartmentAndStatus(FridgeCompartment compartment, InspectionStatus status);

    List<InspectionSession> findByStatus(InspectionStatus status);

    @Query("""
            select distinct s
              from InspectionSession s
              left join fetch s.participants p
             where s.status = :status
               and (
                    s.startedBy.id in :userIds
                 or (p.dormUser.id in :userIds and p.leftAt is null)
               )
            """)
    List<InspectionSession> findActiveSessionsByUsers(
            @Param("status") InspectionStatus status,
            @Param("userIds") Set<UUID> userIds
    );

    @Query("""
            select s
              from InspectionSession s
             where s.fridgeCompartment.id in :compartmentIds
               and s.status = :status
               and coalesce(s.endedAt, s.submittedAt, s.startedAt, s.createdAt) = (
                    select max(coalesce(s2.endedAt, s2.submittedAt, s2.startedAt, s2.createdAt))
                      from InspectionSession s2
                     where s2.fridgeCompartment = s.fridgeCompartment
                       and s2.status = :status
               )
            """)
    List<InspectionSession> findLatestSessionsByCompartmentIds(
            @Param("compartmentIds") Set<UUID> compartmentIds,
            @Param("status") InspectionStatus status
    );
}

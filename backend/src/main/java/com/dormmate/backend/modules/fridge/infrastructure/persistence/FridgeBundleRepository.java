package com.dormmate.backend.modules.fridge.infrastructure.persistence;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.dormmate.backend.modules.auth.domain.DormUser;
import com.dormmate.backend.modules.fridge.domain.FridgeBundle;
import com.dormmate.backend.modules.fridge.domain.FridgeBundleStatus;
import com.dormmate.backend.modules.fridge.domain.FridgeCompartment;

public interface FridgeBundleRepository extends JpaRepository<FridgeBundle, UUID>, FridgeBundleRepositoryCustom {

    List<FridgeBundle> findByOwner(DormUser owner);

    List<FridgeBundle> findByFridgeCompartmentAndStatus(FridgeCompartment compartment, FridgeBundleStatus status);

    Optional<FridgeBundle> findByFridgeCompartmentAndLabelNumberAndStatus(
            FridgeCompartment compartment,
            int labelNumber,
            FridgeBundleStatus status);

    long countByStatus(FridgeBundleStatus status);

    @Query("""
            select fb.fridgeCompartment.id as compartmentId, count(fb) as activeCount
              from FridgeBundle fb
             where fb.status = :status
               and fb.fridgeCompartment.id in :compartmentIds
             group by fb.fridgeCompartment.id
            """)
    List<ActiveBundleCountProjection> countActiveBundlesByCompartmentIds(
            @Param("compartmentIds") List<UUID> compartmentIds,
            @Param("status") FridgeBundleStatus status);

    interface ActiveBundleCountProjection {

        UUID getCompartmentId();

        long getActiveCount();
    }
}

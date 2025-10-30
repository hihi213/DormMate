package com.dormmate.backend.modules.fridge.infrastructure.persistence;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.dormmate.backend.modules.auth.domain.DormUser;
import com.dormmate.backend.modules.fridge.domain.FridgeBundle;
import com.dormmate.backend.modules.fridge.domain.FridgeBundleStatus;
import com.dormmate.backend.modules.fridge.domain.FridgeCompartment;

public interface FridgeBundleRepository extends JpaRepository<FridgeBundle, UUID> {

    List<FridgeBundle> findByOwner(DormUser owner);

    List<FridgeBundle> findByFridgeCompartmentAndStatus(FridgeCompartment compartment, FridgeBundleStatus status);

    Optional<FridgeBundle> findByFridgeCompartmentAndLabelNumberAndStatus(
            FridgeCompartment compartment,
            int labelNumber,
            FridgeBundleStatus status);
}

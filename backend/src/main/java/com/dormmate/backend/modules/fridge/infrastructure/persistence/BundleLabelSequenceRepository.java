package com.dormmate.backend.modules.fridge.infrastructure.persistence;

import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.dormmate.backend.modules.fridge.domain.BundleLabelSequence;

public interface BundleLabelSequenceRepository extends JpaRepository<BundleLabelSequence, UUID> {

    Optional<BundleLabelSequence> findByFridgeCompartmentId(UUID fridgeCompartmentId);
}

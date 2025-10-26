package com.dormmate.backend.modules.fridge.infrastructure.persistence;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.dormmate.backend.modules.fridge.domain.FridgeUnit;

public interface FridgeUnitRepository extends JpaRepository<FridgeUnit, UUID> {

    List<FridgeUnit> findByFloor(short floor);
}

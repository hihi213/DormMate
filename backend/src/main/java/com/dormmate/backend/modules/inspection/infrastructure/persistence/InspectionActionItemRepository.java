package com.dormmate.backend.modules.inspection.infrastructure.persistence;

import org.springframework.data.jpa.repository.JpaRepository;

import com.dormmate.backend.modules.inspection.domain.InspectionActionItem;

public interface InspectionActionItemRepository extends JpaRepository<InspectionActionItem, Long> {
}

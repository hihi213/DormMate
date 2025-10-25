package com.dormmate.backend.modules.inspection.infrastructure;

import org.springframework.data.jpa.repository.JpaRepository;

import com.dormmate.backend.modules.inspection.domain.UnregisteredItemEvent;

public interface UnregisteredItemEventRepository extends JpaRepository<UnregisteredItemEvent, Long> {
}

package com.dormmate.backend.modules.penalty.infrastructure.persistence;

import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.dormmate.backend.modules.penalty.domain.PenaltyHistory;

public interface PenaltyHistoryRepository extends JpaRepository<PenaltyHistory, UUID> {
}

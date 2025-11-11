package com.dormmate.backend.modules.fridge.infrastructure.persistence;

import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import com.dormmate.backend.modules.fridge.domain.FridgeBundleOwnershipIssueView;

public interface FridgeBundleOwnershipIssueViewRepository extends JpaRepository<FridgeBundleOwnershipIssueView, UUID> {

    Page<FridgeBundleOwnershipIssueView> findByOwnerUserId(UUID ownerUserId, Pageable pageable);
}

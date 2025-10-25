package com.dormmate.backend.modules.fridge.infrastructure;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.dormmate.backend.modules.fridge.domain.FridgeBundle;
import com.dormmate.backend.modules.fridge.domain.FridgeItem;
import com.dormmate.backend.modules.fridge.domain.FridgeItemStatus;

public interface FridgeItemRepository extends JpaRepository<FridgeItem, UUID> {

    List<FridgeItem> findByBundleAndStatus(FridgeBundle bundle, FridgeItemStatus status);

    List<FridgeItem> findByBundle(FridgeBundle bundle);
}

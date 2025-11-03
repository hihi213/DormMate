package com.dormmate.backend.modules.fridge.infrastructure.persistence;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import com.dormmate.backend.modules.fridge.domain.FridgeBundle;

public interface FridgeBundleRepositoryCustom {

    Page<FridgeBundle> searchBundles(FridgeBundleSearchCondition condition, Pageable pageable);
}

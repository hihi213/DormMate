package com.dormmate.backend.modules.fridge.infrastructure.persistence;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.dormmate.backend.modules.fridge.domain.FridgeBundle;
import com.dormmate.backend.modules.fridge.domain.FridgeItem;
import com.dormmate.backend.modules.fridge.domain.FridgeItemStatus;

public interface FridgeItemRepository extends JpaRepository<FridgeItem, UUID> {

    List<FridgeItem> findByBundleAndStatus(FridgeBundle bundle, FridgeItemStatus status);

    List<FridgeItem> findByBundle(FridgeBundle bundle);

    long countByStatus(FridgeItemStatus status);

    long countByStatusAndExpiryDateLessThanEqual(FridgeItemStatus status, LocalDate expiryDate);

    long countByStatusAndExpiryDateBetween(FridgeItemStatus status, LocalDate startDate, LocalDate endDate);

    @Query("""
            select fi
              from FridgeItem fi
              join fetch fi.bundle b
              join fetch b.owner owner
             where fi.status = :status
               and b.status = com.dormmate.backend.modules.fridge.domain.FridgeBundleStatus.ACTIVE
               and fi.expiryDate between :start and :end
            """)
    List<FridgeItem> findActiveItemsExpiringBetween(
            @Param("status") FridgeItemStatus status,
            @Param("start") LocalDate start,
            @Param("end") LocalDate end
    );

    @Query("""
            select fi
              from FridgeItem fi
              join fetch fi.bundle b
              join fetch b.owner owner
             where fi.status = :status
               and b.status = com.dormmate.backend.modules.fridge.domain.FridgeBundleStatus.ACTIVE
               and fi.expiryDate < :date
            """)
    List<FridgeItem> findActiveItemsExpiredBefore(
            @Param("status") FridgeItemStatus status,
            @Param("date") LocalDate date
    );
}

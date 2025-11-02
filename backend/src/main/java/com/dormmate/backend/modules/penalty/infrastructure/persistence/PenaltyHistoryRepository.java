package com.dormmate.backend.modules.penalty.infrastructure.persistence;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

import com.dormmate.backend.modules.penalty.domain.PenaltyHistory;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PenaltyHistoryRepository extends JpaRepository<PenaltyHistory, UUID> {

    interface PenaltyTotal {
        UUID getUserId();

        Long getTotalPoints();
    }

    @Query("""
            select ph.user.id as userId,
                   coalesce(sum(ph.points), 0) as totalPoints
              from PenaltyHistory ph
             where ph.user.id in :userIds
               and (ph.expiresAt is null or ph.expiresAt > :now)
             group by ph.user.id
            """)
    List<PenaltyTotal> sumPenaltiesByUserIds(
            @Param("userIds") Iterable<UUID> userIds,
            @Param("now") OffsetDateTime now
    );
}

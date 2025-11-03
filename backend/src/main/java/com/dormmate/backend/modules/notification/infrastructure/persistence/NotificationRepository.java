package com.dormmate.backend.modules.notification.infrastructure.persistence;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.dormmate.backend.modules.notification.domain.Notification;
import com.dormmate.backend.modules.notification.domain.NotificationState;

public interface NotificationRepository extends JpaRepository<Notification, UUID> {

    List<Notification> findByUserIdAndState(UUID userId, NotificationState state);

    Optional<Notification> findByUserIdAndDedupeKey(UUID userId, String dedupeKey);

    Optional<Notification> findByIdAndUserId(UUID id, UUID userId);

    long countByUserIdAndState(UUID userId, NotificationState state);

    List<Notification> findByUserIdAndTtlAtBeforeAndStateNot(UUID userId, OffsetDateTime threshold, NotificationState state);

    @Query("""
            select n
              from Notification n
             where n.user.id = :userId
               and n.state in :states
             order by case
                        when n.state = com.dormmate.backend.modules.notification.domain.NotificationState.UNREAD then 0
                        when n.state = com.dormmate.backend.modules.notification.domain.NotificationState.READ then 1
                        else 2
                      end,
                      n.createdAt desc
            """)
    Page<Notification> findByUserIdAndStates(
            @Param("userId") UUID userId,
            @Param("states") List<NotificationState> states,
            Pageable pageable
    );
}

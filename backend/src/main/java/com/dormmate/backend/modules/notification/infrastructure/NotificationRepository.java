package com.dormmate.backend.modules.notification.infrastructure;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.dormmate.backend.modules.notification.domain.Notification;
import com.dormmate.backend.modules.notification.domain.NotificationState;

public interface NotificationRepository extends JpaRepository<Notification, UUID> {

    List<Notification> findByUserIdAndState(UUID userId, NotificationState state);

    Optional<Notification> findByUserIdAndDedupeKey(UUID userId, String dedupeKey);
}

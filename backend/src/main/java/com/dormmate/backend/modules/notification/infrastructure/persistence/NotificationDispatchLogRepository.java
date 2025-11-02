package com.dormmate.backend.modules.notification.infrastructure.persistence;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.dormmate.backend.modules.notification.domain.NotificationDispatchLog;
import com.dormmate.backend.modules.notification.domain.NotificationDispatchStatus;

public interface NotificationDispatchLogRepository extends JpaRepository<NotificationDispatchLog, Long> {

    long countByStatus(NotificationDispatchStatus status);

    List<NotificationDispatchLog> findByNotification_Id(UUID notificationId);
}

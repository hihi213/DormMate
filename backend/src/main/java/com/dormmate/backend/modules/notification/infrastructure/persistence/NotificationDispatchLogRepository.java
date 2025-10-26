package com.dormmate.backend.modules.notification.infrastructure.persistence;

import org.springframework.data.jpa.repository.JpaRepository;

import com.dormmate.backend.modules.notification.domain.NotificationDispatchLog;

public interface NotificationDispatchLogRepository extends JpaRepository<NotificationDispatchLog, Long> {
}

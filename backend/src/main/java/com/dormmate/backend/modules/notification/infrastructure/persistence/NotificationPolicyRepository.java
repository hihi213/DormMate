package com.dormmate.backend.modules.notification.infrastructure.persistence;

import org.springframework.data.jpa.repository.JpaRepository;

import com.dormmate.backend.modules.notification.domain.NotificationPolicy;

public interface NotificationPolicyRepository extends JpaRepository<NotificationPolicy, String> {
}

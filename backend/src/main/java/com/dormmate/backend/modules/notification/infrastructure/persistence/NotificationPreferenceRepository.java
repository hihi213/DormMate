package com.dormmate.backend.modules.notification.infrastructure.persistence;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.dormmate.backend.modules.notification.domain.NotificationPreference;
import com.dormmate.backend.modules.notification.domain.NotificationPreferenceId;

public interface NotificationPreferenceRepository extends JpaRepository<NotificationPreference, NotificationPreferenceId> {

    List<NotificationPreference> findByIdUserId(java.util.UUID userId);
}

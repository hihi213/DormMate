package com.dormmate.backend.modules.audit.application;

import java.util.HashMap;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

import com.dormmate.backend.modules.audit.domain.AuditLog;
import com.dormmate.backend.modules.audit.infrastructure.AuditLogRepository;
import com.dormmate.backend.modules.auth.domain.DormUser;

import jakarta.persistence.EntityManager;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuditLogService {

    private final AuditLogRepository auditLogRepository;
    private final EntityManager entityManager;

    public AuditLogService(AuditLogRepository auditLogRepository, EntityManager entityManager) {
        this.auditLogRepository = auditLogRepository;
        this.entityManager = entityManager;
    }

    @Transactional
    public void record(AuditLogCommand command) {
        Objects.requireNonNull(command.actionType(), "actionType is required");
        Objects.requireNonNull(command.resourceType(), "resourceType is required");
        Objects.requireNonNull(command.resourceKey(), "resourceKey is required");

        AuditLog auditLog = new AuditLog();
        auditLog.setActionType(command.actionType());
        auditLog.setResourceType(command.resourceType());
        auditLog.setResourceKey(command.resourceKey());

        if (command.actorUserId() != null) {
            DormUser actorReference = entityManager.getReference(DormUser.class, command.actorUserId());
            auditLog.setActor(actorReference);
        }

        auditLog.setCorrelationId(command.correlationId());

        if (command.detail() != null && !command.detail().isEmpty()) {
            auditLog.setDetail(new HashMap<>(command.detail()));
        }

        auditLogRepository.save(auditLog);
    }

    public record AuditLogCommand(
            String actionType,
            String resourceType,
            String resourceKey,
            UUID actorUserId,
            UUID correlationId,
            Map<String, Object> detail
    ) {
    }
}

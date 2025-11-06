package com.dormmate.backend.modules.inspection.infrastructure.persistence;

import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.dormmate.backend.modules.inspection.domain.InspectionAuditLog;

public interface InspectionAuditLogRepository extends JpaRepository<InspectionAuditLog, UUID> {
}

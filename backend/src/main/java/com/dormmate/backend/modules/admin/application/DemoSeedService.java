package com.dormmate.backend.modules.admin.application;

import java.nio.charset.StandardCharsets;
import java.sql.Connection;
import java.util.Map;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.EncodedResource;
import org.springframework.jdbc.datasource.DataSourceUtils;
import org.springframework.jdbc.datasource.init.ScriptException;
import org.springframework.jdbc.datasource.init.ScriptUtils;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Service;

import javax.sql.DataSource;

import com.dormmate.backend.global.security.SecurityUtils;
import com.dormmate.backend.modules.audit.application.AuditLogService;

@Service
public class DemoSeedService {

    private static final Logger log = LoggerFactory.getLogger(DemoSeedService.class);

    private static final String FRIDGE_DEMO_SEED_SCRIPT = "db/demo/fridge_exhibition_items.sql";

    private final DataSource dataSource;
    private final AuditLogService auditLogService;

    public DemoSeedService(@NonNull DataSource dataSource, AuditLogService auditLogService) {
        this.dataSource = dataSource;
        this.auditLogService = auditLogService;
    }

    public void seedFridgeDemoData() {
        Resource resource = new ClassPathResource(FRIDGE_DEMO_SEED_SCRIPT);
        Connection connection = DataSourceUtils.getConnection(dataSource);
        try {
            ScriptUtils.executeSqlScript(connection, new EncodedResource(resource, StandardCharsets.UTF_8));
            log.info("Fridge demo seed script executed successfully");
        } catch (ScriptException ex) {
            Throwable root = ex;
            while (root.getCause() != null) {
                root = root.getCause();
            }
            log.error("Failed to execute demo seed script root cause: {}", root.getMessage());
            log.error("Failed to execute demo seed script", ex);
            throw new IllegalStateException("Failed to execute fridge demo seed script: " + root.getMessage(), ex);
        } finally {
            DataSourceUtils.releaseConnection(connection, dataSource);
        }

        UUID actorUserId = null;
        try {
            actorUserId = SecurityUtils.getCurrentUserId();
        } catch (Exception ignored) {
            // allow null actor when executed outside HTTP context
        }
        auditLogService.record(new AuditLogService.AuditLogCommand(
                "FRIDGE_DEMO_SEED_EXECUTED",
                "DEMO_DATA",
                "FRIDGE",
                actorUserId,
                null,
                Map.of("script", FRIDGE_DEMO_SEED_SCRIPT)
        ));
    }
}

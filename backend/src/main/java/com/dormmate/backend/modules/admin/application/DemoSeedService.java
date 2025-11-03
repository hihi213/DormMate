package com.dormmate.backend.modules.admin.application;

import java.nio.charset.StandardCharsets;
import java.sql.Connection;

import javax.sql.DataSource;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.EncodedResource;
import org.springframework.jdbc.datasource.DataSourceUtils;
import org.springframework.jdbc.datasource.init.ScriptException;
import org.springframework.jdbc.datasource.init.ScriptUtils;
import org.springframework.stereotype.Service;

@Service
public class DemoSeedService {

    private static final Logger log = LoggerFactory.getLogger(DemoSeedService.class);

    private static final String FRIDGE_DEMO_SEED_SCRIPT = "db/demo/fridge_exhibition_items.sql";

    private final DataSource dataSource;

    public DemoSeedService(DataSource dataSource) {
        this.dataSource = dataSource;
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
    }
}

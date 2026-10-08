package com.dormmate.backend.modules.admin;

import com.dormmate.backend.modules.admin.application.DemoSeedService;
import com.dormmate.backend.modules.admin.presentation.DemoSeedController;
import com.dormmate.backend.modules.audit.application.AuditLogService;
import org.junit.jupiter.api.Test;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;
import javax.sql.DataSource;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

class DemoSeedProfileTest {
    @Test
    void productionDoesNotRegisterDemoSeedEvenWithDemoProfile() {
        try (var context = context("prod", "demo")) {
            assertThat(context.getBeansOfType(DemoSeedController.class)).isEmpty();
            assertThat(context.getBeansOfType(DemoSeedService.class)).isEmpty();
        }
    }

    @Test
    void developmentCanRegisterDemoSeed() {
        try (var context = context("local")) {
            assertThat(context.getBeansOfType(DemoSeedController.class)).hasSize(1);
            assertThat(context.getBeansOfType(DemoSeedService.class)).hasSize(1);
        }
    }

    private AnnotationConfigApplicationContext context(String... profiles) {
        var context = new AnnotationConfigApplicationContext();
        context.getEnvironment().setActiveProfiles(profiles);
        context.registerBean(DataSource.class, () -> mock(DataSource.class));
        context.registerBean(AuditLogService.class, () -> mock(AuditLogService.class));
        context.register(DemoSeedService.class, DemoSeedController.class);
        context.refresh();
        return context;
    }
}

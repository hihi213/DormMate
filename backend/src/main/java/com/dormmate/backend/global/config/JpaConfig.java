package com.dormmate.backend.global.config;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.UUID;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.auditing.DateTimeProvider;
import org.springframework.data.domain.AuditorAware;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;

@Configuration
@EnableJpaRepositories(basePackages = "com.dormmate.backend.modules")
@EnableJpaAuditing(auditorAwareRef = "auditorAware", dateTimeProviderRef = "utcOffsetDateTimeProvider")
public class JpaConfig {

    @Bean
    public AuditorAware<UUID> auditorAware() {
        return new DormmateAuditorAware();
    }

    @Bean
    public DateTimeProvider utcOffsetDateTimeProvider() {
        return () -> Optional.of(OffsetDateTime.now(ZoneOffset.UTC));
    }
}

package com.dormmate.backend.global.config;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.repository.configuration.EnableRedisRepositories;

/**
 * Restricts Redis repository scanning to the dedicated Redis module package.
 * This prevents Spring Data Redis from trying to bind every JPA repository
 * while still letting future Redis repositories be registered under
 * {@code com.dormmate.backend.modules.redis}.
 */
@Configuration(proxyBeanMethods = false)
@ConditionalOnProperty(value = "dormmate.redis.repositories.enabled", havingValue = "true")
@EnableRedisRepositories(basePackages = "com.dormmate.backend.modules.redis")
public class RedisConfig {
}

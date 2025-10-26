package com.dormmate.backend.global.common.time;

import java.time.Clock;
import java.time.ZoneOffset;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Provides shared time-related beans so modules use a single UTC clock source.
 */
@Configuration
public class TimeConfig {

    @Bean
    public Clock utcClock() {
        return Clock.system(ZoneOffset.UTC);
    }
}

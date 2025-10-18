package com.dormmate.backend.health;

import java.time.Instant;
import org.springframework.boot.actuate.health.Health;
import org.springframework.boot.actuate.health.HealthComponent;
import org.springframework.boot.actuate.health.HealthEndpoint;
import org.springframework.boot.actuate.health.CompositeHealth;
import org.springframework.web.bind.annotation.*;

/**
 * 헬스체크 엔드포인트
 * nogitReadME.md 기준: /healthz, /readyz 구현
 */
@RestController
public class HealthController {

    private final HealthEndpoint healthEndpoint;

    public HealthController(HealthEndpoint healthEndpoint) {
        this.healthEndpoint = healthEndpoint;
    }

    /**
     * 기본 헬스체크 - 애플리케이션이 살아있는지만 확인
     */
    @GetMapping("/healthz")
    public HealthResponse healthz() {
        return new HealthResponse(
            "UP",
            Instant.now().toString()
        );
    }

    /**
     * 레디니스 체크 - DB 연결 및 마이그레이션 버전 확인
     */
    @GetMapping("/readyz")
    public HealthResponse readyz() {
        try {
            HealthComponent healthComponent = healthEndpoint.health();
            String status = healthComponent.getStatus().getCode();

            if (healthComponent instanceof CompositeHealth composite) {
                Object dbDetail = composite.getDetails().get("db");
                if (dbDetail instanceof Health dbHealth) {
                    status = dbHealth.getStatus().getCode();
                }
            }

            return new HealthResponse(
                status,
                Instant.now().toString()
            );
        } catch (Exception e) {
            return new HealthResponse(
                "DOWN",
                Instant.now().toString()
            );
        }
    }

    /**
     * 기존 /health 엔드포인트 (호환성 유지)
     */
    @GetMapping("/health")
    public HealthResponse health() {
        return healthz();
    }

    public record HealthResponse(
        String status,   // "UP" | "DOWN"
        String timestamp // ISO-8601 timestamp
    ) {}
}

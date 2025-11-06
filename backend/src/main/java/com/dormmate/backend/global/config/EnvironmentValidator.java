package com.dormmate.backend.global.config;

import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

/**
 * 애플리케이션 시작 시 필수 환경변수 검증
 * nogitReadME.md 기준: 필수 키 없으면 실패
 */
@Component
public class EnvironmentValidator {

    private final Environment environment;

    public EnvironmentValidator(Environment environment) {
        this.environment = environment;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void validateEnvironment() {
        List<String> missingVars = new ArrayList<>();
        List<String> invalidVars = new ArrayList<>();

        // 필수 환경변수 목록 (Spring Boot 설정 기준)
        String[] requiredVars = {
            "spring.datasource.url",
            "jwt.secret", 
            "jwt.expiration",
            "app.cors.allowed-origins",
            "server.port"
        };

        // 필수 변수 존재 여부 검증
        for (String var : requiredVars) {
            Optional<String> value = Optional.ofNullable(environment.getProperty(var));
            if (value.isEmpty() || value.map(String::trim).orElse("").isEmpty()) {
                missingVars.add(var);
            }
        }

        // JWT_SECRET 보안 검증
        Optional<String> jwtSecret = Optional.ofNullable(environment.getProperty("jwt.secret"));
        if (jwtSecret.filter(secret -> secret.equals("dev-jwt-secret-key-change-in-production-2025")).isPresent()) {
            invalidVars.add("jwt.secret: 기본값을 실제 랜덤 문자열로 변경하세요");
        }

        // JWT_EXPIRATION 숫자 검증
        Optional<String> jwtExpiration = Optional.ofNullable(environment.getProperty("jwt.expiration"));
        if (jwtExpiration.isPresent()) {
            try {
                long expiration = Long.parseLong(jwtExpiration.get());
                if (expiration < 300000 || expiration > 86400000) { // 5분~24시간 (밀리초)
                    invalidVars.add("jwt.expiration: 300000-86400000 밀리초 범위여야 합니다");
                }
            } catch (NumberFormatException e) {
                invalidVars.add("jwt.expiration: 숫자여야 합니다");
            }
        }

        // 오류가 있으면 애플리케이션 종료
        if (!missingVars.isEmpty() || !invalidVars.isEmpty()) {
            System.err.println("❌ 환경변수 검증 실패:");
            
            if (!missingVars.isEmpty()) {
                System.err.println("  누락된 필수 변수: " + String.join(", ", missingVars));
            }
            
            if (!invalidVars.isEmpty()) {
                System.err.println("  잘못된 값:");
                invalidVars.forEach(v -> System.err.println("    - " + v));
            }
            
            System.err.println("\n.env 파일을 확인하고 backend/ENV_SETUP.md를 참조하세요.");
            System.exit(1);
        }

        System.out.println("✅ 환경변수 검증 완료");
    }
}

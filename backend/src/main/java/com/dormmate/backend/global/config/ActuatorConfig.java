package com.dormmate.backend.global.config;

import org.springframework.boot.actuate.web.exchanges.HttpExchangeRepository;
import org.springframework.boot.actuate.web.exchanges.InMemoryHttpExchangeRepository;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Actuator 설정
 * nogitReadME.md 기준: httpexchanges 기능 사용 (가장 빠름, 포맷은 정해져 있음)
 */
@Configuration
public class ActuatorConfig {

    /**
     * Actuator의 '/httpexchanges' 엔드포인트가 사용하는 Repository Bean.
     * 
     * [주의] 기본 구현체인 InMemoryHttpExchangeRepository는 메모리 누수 위험이 있어
     * 운영 환경에서는 절대 사용하면 안 됩니다. (최대 100개까지만 저장)
     * 
     * MVP 단계에서는 디버깅과 모니터링을 위해 사용하되,
     * R1 하드닝 단계에서 Logging이나 DB 저장 방식으로 교체할 예정입니다.
     */
    @Bean
    public HttpExchangeRepository httpExchangeRepository() {
        return new InMemoryHttpExchangeRepository();
    }
}
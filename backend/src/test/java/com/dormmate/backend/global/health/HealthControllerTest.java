package com.dormmate.backend.global.health;

import org.junit.jupiter.api.Test;
import org.springframework.boot.actuate.health.Health;
import org.springframework.boot.actuate.health.HealthEndpoint;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

class HealthControllerTest {
    @Test void readinessReflectsDependenciesAndExceptions() {
        var endpoint = mock(HealthEndpoint.class);
        var controller = new HealthController(endpoint);
        when(endpoint.health()).thenReturn(Health.up().build());
        assertThat(controller.readyz().getStatusCode().value()).isEqualTo(200);
        when(endpoint.health()).thenReturn(Health.down().build());
        assertThat(controller.readyz().getStatusCode().value()).isEqualTo(503);
        when(endpoint.health()).thenThrow(new IllegalStateException("unavailable"));
        var failure = controller.readyz();
        assertThat(failure.getStatusCode().value()).isEqualTo(503);
        assertThat(failure.getBody().status()).isEqualTo("DOWN");
    }
}

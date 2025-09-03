package com.dormmate.backend.health;

import java.time.Instant;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/health")
public class HealthController {

    @GetMapping
    public HealthResponse health() {
        return new HealthResponse(
            "UP",
            Instant.now().toString()
        );
    }

    public record HealthResponse(
        String status,   // "UP" | "DOWN"
        String now       // ISO-8601 timestamp
    ) {}
}

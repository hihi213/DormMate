package com.dormmate.backend.controller;

import io.swagger.v3.oas.annotations.Operation;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class TestController {

    @Operation(summary = "폴링 커서 조회", description = "sinceId 이후를 ASC")
    @CrossOrigin(origins = "http://localhost:5173")
    @GetMapping("/api/test")
    public String hello() {
        return "Hello from Spring Boot!";
    }
}

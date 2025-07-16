package com.dormmate.backend.controller;

import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

    @RestController
    public class TestController {

        // 개발 환경에서 React 앱(localhost:5173)의 요청을 허용하기 위한 설정
        @CrossOrigin(origins = "http://localhost:5173")
        @GetMapping("/api/test")
        public String hello() {
            return "Hello from Spring Boot!";
        }
    }


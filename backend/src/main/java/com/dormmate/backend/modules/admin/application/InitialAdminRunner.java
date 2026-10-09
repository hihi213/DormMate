package com.dormmate.backend.modules.admin.application;

import java.nio.file.Files;
import java.nio.file.Path;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(name = "dormmate.bootstrap.enabled", havingValue = "true")
public class InitialAdminRunner implements ApplicationRunner {
    private static final Logger log = LoggerFactory.getLogger(InitialAdminRunner.class);
    private final InitialAdminService service;
    @Value("${dormmate.bootstrap.login-id:}") private String loginId;
    @Value("${dormmate.bootstrap.password-file:}") private String passwordFile;
    @Value("${dormmate.bootstrap.name:}") private String name;
    @Value("${dormmate.bootstrap.email:}") private String email;

    public InitialAdminRunner(InitialAdminService service) { this.service = service; }

    @Override
    public void run(ApplicationArguments args) throws Exception {
        if (passwordFile.isBlank()) {
            throw new IllegalArgumentException("Bootstrap password file is required");
        }
        // File avoids exposing the plaintext password in command arguments or logs.
        String password = Files.readString(Path.of(passwordFile)).stripTrailing();
        boolean created = service.createOnce(loginId, password, name, email);
        log.info(created ? "Initial administrator created; disable bootstrap and remove its secret file"
                : "Administrator bootstrap already completed; no account changed");
    }
}

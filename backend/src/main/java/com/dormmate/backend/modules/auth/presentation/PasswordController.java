package com.dormmate.backend.modules.auth.presentation;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import com.dormmate.backend.global.security.JwtAuthenticationPrincipal;
import com.dormmate.backend.modules.admin.application.ResidentLifecycleService;

@RestController
public class PasswordController {
    private final ResidentLifecycleService service;
    public PasswordController(ResidentLifecycleService service) { this.service = service; }
    @PostMapping("/auth/password")
    public ResponseEntity<Void> change(@AuthenticationPrincipal JwtAuthenticationPrincipal user,
                                      @Valid @RequestBody PasswordChange request) {
        service.changePassword(user.userId(), user.credentialVersion(), request.currentPassword(), request.newPassword());
        return ResponseEntity.noContent().build();
    }
    public record PasswordChange(@NotBlank @Size(max=100) String currentPassword,
                                 @NotBlank @Size(min=8,max=72) String newPassword) {}
}

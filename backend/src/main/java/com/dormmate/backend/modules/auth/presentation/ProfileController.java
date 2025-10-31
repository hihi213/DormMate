package com.dormmate.backend.modules.auth.presentation;

import com.dormmate.backend.modules.auth.presentation.dto.UserProfileResponse;
import com.dormmate.backend.global.security.JwtAuthenticationPrincipal;
import com.dormmate.backend.modules.auth.application.AuthService;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class ProfileController {

    private final AuthService authService;

    public ProfileController(AuthService authService) {
        this.authService = authService;
    }

    @GetMapping("/profile/me")
    public ResponseEntity<UserProfileResponse> currentUser(@AuthenticationPrincipal JwtAuthenticationPrincipal principal) {
        UserProfileResponse profile = authService.loadProfile(principal.userId());
        return ResponseEntity.ok(profile);
    }
}

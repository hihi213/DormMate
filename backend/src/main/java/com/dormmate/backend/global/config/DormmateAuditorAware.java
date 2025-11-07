package com.dormmate.backend.global.config;

import java.security.Principal;
import java.util.Optional;
import java.util.UUID;

import com.dormmate.backend.global.security.JwtAuthenticationPrincipal;

import org.springframework.data.domain.AuditorAware;
import org.springframework.lang.NonNull;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

/**
 * Resolves the current auditor (DormMate user id) for JPA auditing.
 * Falls back to {@code Optional.empty()} when no authenticated principal is available.
 */
public class DormmateAuditorAware implements AuditorAware<UUID> {

    @Override
    @NonNull
    public Optional<UUID> getCurrentAuditor() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()) {
            return Optional.empty();
        }

        Object principal = authentication.getPrincipal();
        if (principal instanceof JwtAuthenticationPrincipal jwtPrincipal) {
            return Optional.ofNullable(jwtPrincipal.userId());
        }

        if (principal instanceof Principal standardPrincipal) {
            try {
                return Optional.of(UUID.fromString(standardPrincipal.getName()));
            } catch (IllegalArgumentException ignored) {
                return Optional.empty();
            }
        }

        return Optional.empty();
    }
}

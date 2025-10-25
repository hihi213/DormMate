package com.dormmate.backend.global.security;

import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.server.ResponseStatusException;

public final class SecurityUtils {

    private SecurityUtils() {
    }

    public static JwtAuthenticationPrincipal getCurrentPrincipal() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !(authentication.getPrincipal() instanceof JwtAuthenticationPrincipal principal)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED");
        }
        return principal;
    }

    public static UUID getCurrentUserId() {
        return getCurrentPrincipal().userId();
    }

    public static boolean hasRole(String roleCode) {
        return getCurrentPrincipal().roles().contains(roleCode);
    }
}

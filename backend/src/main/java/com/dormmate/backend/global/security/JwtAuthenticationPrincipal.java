package com.dormmate.backend.global.security;

import java.util.List;
import java.util.UUID;

public record JwtAuthenticationPrincipal(UUID userId, String loginId, List<String> roles) {
}

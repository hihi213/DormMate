package com.dormmate.backend.modules.auth.presentation.dto;

public record LoginResponse(TokenPairResponse tokens, UserProfileResponse user) {
}

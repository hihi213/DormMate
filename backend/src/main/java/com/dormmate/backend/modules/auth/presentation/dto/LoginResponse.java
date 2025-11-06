package com.dormmate.backend.modules.auth.presentation.dto;

import com.dormmate.backend.modules.auth.presentation.dto.UserProfileResponse;

public record LoginResponse(TokenPairResponse tokens, UserProfileResponse user) {
}

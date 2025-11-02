package com.dormmate.backend.modules.admin.presentation.dto;

import jakarta.validation.constraints.NotBlank;

public record UpdateUserStatusRequest(@NotBlank String status) {
}

package com.dormmate.backend.modules.admin.presentation.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

public record UpdateAdminPoliciesRequest(
        @NotNull @Valid NotificationPolicy notification,
        @NotNull @Valid PenaltyPolicy penalty
) {

    public record NotificationPolicy(
            @NotBlank
            @Pattern(regexp = "^\\d{2}:\\d{2}$", message = "배치 시각은 HH:mm 형식이어야 합니다.")
            String batchTime,
            @Min(0)
            int dailyLimit,
            @Min(1)
            int ttlHours
    ) {
    }

    public record PenaltyPolicy(
            @Min(0)
            int limit,
            @NotBlank
            String template
    ) {
    }
}

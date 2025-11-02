package com.dormmate.backend.modules.admin.presentation.dto;

public record AdminPoliciesResponse(NotificationPolicy notification, PenaltyPolicy penalty) {

    public record NotificationPolicy(String batchTime, int dailyLimit, int ttlHours) {
    }

    public record PenaltyPolicy(int limit, String template) {
    }
}

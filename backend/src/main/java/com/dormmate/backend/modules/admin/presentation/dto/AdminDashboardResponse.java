package com.dormmate.backend.modules.admin.presentation.dto;

import java.util.List;

public record AdminDashboardResponse(
        List<SummaryCard> summary,
        List<TimelineEvent> timeline,
        List<QuickAction> quickActions
) {

    public record SummaryCard(String id, String label, String value, String description) {
    }

    public record TimelineEvent(String id, String time, String title, String detail) {
    }

    public record QuickAction(String id, String title, String description, String href, String icon) {
    }
}

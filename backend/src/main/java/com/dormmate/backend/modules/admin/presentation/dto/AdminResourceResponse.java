package com.dormmate.backend.modules.admin.presentation.dto;

import java.util.List;

public record AdminResourceResponse(List<Resource> items) {

    public record Resource(
            String id,
            String facility,
            String name,
            String location,
            String status,
            String capacity,
            String manager,
            String rooms,
            String labelRange,
            String issue,
            String lastInspection
    ) {
    }
}

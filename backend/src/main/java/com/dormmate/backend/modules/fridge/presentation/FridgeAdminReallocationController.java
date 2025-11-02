package com.dormmate.backend.modules.fridge.presentation;

import com.dormmate.backend.modules.fridge.application.FridgeReallocationService;
import com.dormmate.backend.modules.fridge.presentation.dto.admin.ReallocationApplyRequest;
import com.dormmate.backend.modules.fridge.presentation.dto.admin.ReallocationApplyResponse;
import com.dormmate.backend.modules.fridge.presentation.dto.admin.ReallocationPreviewRequest;
import com.dormmate.backend.modules.fridge.presentation.dto.admin.ReallocationPreviewResponse;

import jakarta.validation.Valid;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/admin/fridge/reallocations")
public class FridgeAdminReallocationController {

    private final FridgeReallocationService fridgeReallocationService;

    public FridgeAdminReallocationController(FridgeReallocationService fridgeReallocationService) {
        this.fridgeReallocationService = fridgeReallocationService;
    }

    @PostMapping("/preview")
    public ResponseEntity<ReallocationPreviewResponse> preview(
            @Valid @RequestBody ReallocationPreviewRequest request
    ) {
        return ResponseEntity.ok(fridgeReallocationService.preview(request));
    }

    @PostMapping("/apply")
    public ResponseEntity<ReallocationApplyResponse> apply(
            @Valid @RequestBody ReallocationApplyRequest request
    ) {
        return ResponseEntity.ok(fridgeReallocationService.apply(request));
    }
}

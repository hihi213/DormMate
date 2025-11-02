package com.dormmate.backend.modules.fridge.presentation;

import java.time.OffsetDateTime;

import com.dormmate.backend.modules.fridge.application.FridgeService;
import com.dormmate.backend.modules.fridge.presentation.dto.BundleListResponse;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/admin/fridge/bundles")
public class FridgeAdminBundleController {

    private final FridgeService fridgeService;

    public FridgeAdminBundleController(FridgeService fridgeService) {
        this.fridgeService = fridgeService;
    }

    @GetMapping("/deleted")
    public ResponseEntity<BundleListResponse> getDeletedBundles(
            @RequestParam(name = "since", required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime since,
            @RequestParam(name = "page", defaultValue = "0") int page,
            @RequestParam(name = "size", defaultValue = "20") int size
    ) {
        return ResponseEntity.ok(fridgeService.getDeletedBundles(since, page, size));
    }
}

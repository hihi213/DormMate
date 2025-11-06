package com.dormmate.backend.modules.admin.presentation;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;

import com.dormmate.backend.modules.admin.application.DemoSeedService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/admin/seed")
public class DemoSeedController {

    private final DemoSeedService demoSeedService;

    public DemoSeedController(DemoSeedService demoSeedService) {
        this.demoSeedService = demoSeedService;
    }

    @Operation(summary = "데모 데이터 초기화", description = "관리자가 냉장고 데모 데이터를 초기화한다.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "초기화 성공"),
            @ApiResponse(responseCode = "403", description = "관리자 권한 필요")
    })
    @PostMapping("/fridge-demo")
    public ResponseEntity<SeedResponse> seedFridgeDemo() {
        demoSeedService.seedFridgeDemoData();
        return ResponseEntity.ok(new SeedResponse("FRIDGE_DEMO_DATA_REFRESHED", OffsetDateTime.now(ZoneOffset.UTC)));
    }

    @Operation(summary = "데모 데이터 전체 초기화", description = "관리자가 fn_reset_demo_dataset 함수를 실행합니다.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "초기화 성공"),
            @ApiResponse(responseCode = "403", description = "관리자 권한 필요")
    })
    @PostMapping("/demo-reset")
    public ResponseEntity<SeedResponse> resetDemoDataset() {
        demoSeedService.resetDemoDataset();
        return ResponseEntity.ok(new SeedResponse("DEMO_DATASET_RESET", OffsetDateTime.now(ZoneOffset.UTC)));
    }

    public record SeedResponse(String message, OffsetDateTime executedAt) {
    }
}

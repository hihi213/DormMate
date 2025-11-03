package com.dormmate.backend.modules.fridge.presentation;

import java.util.UUID;

import com.dormmate.backend.modules.fridge.application.FridgeAdminService;
import com.dormmate.backend.modules.fridge.presentation.dto.FridgeSlotResponse;
import com.dormmate.backend.modules.fridge.presentation.dto.UpdateCompartmentConfigRequest;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;

import jakarta.validation.Valid;

import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/admin/fridge/compartments")
public class FridgeAdminController {

    private final FridgeAdminService fridgeAdminService;

    public FridgeAdminController(FridgeAdminService fridgeAdminService) {
        this.fridgeAdminService = fridgeAdminService;
    }

    @Operation(summary = "냉장고 칸 메타데이터 조회", description = "관리자가 층별 칸 정보를 확인한다.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "조회 성공"),
            @ApiResponse(responseCode = "403", description = "관리자 권한 필요")
    })
    @GetMapping
    public ResponseEntity<List<FridgeSlotResponse>> listCompartments(
            @RequestParam(name = "floor", required = false) Integer floor,
            @RequestParam(name = "view", required = false) String view
    ) {
        List<FridgeSlotResponse> response = fridgeAdminService.listCompartments(floor, view);
        return ResponseEntity.ok(response);
    }

    @Operation(summary = "냉장고 칸 설정 수정", description = "관리자가 특정 칸의 허용량과 상태를 조정한다.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "수정 성공"),
            @ApiResponse(responseCode = "403", description = "관리자 권한 필요"),
            @ApiResponse(responseCode = "404", description = "대상 칸 없음"),
            @ApiResponse(responseCode = "409", description = "검사 세션 진행 중"),
            @ApiResponse(responseCode = "422", description = "현재 활성 포장 수보다 낮은 용량으로 설정 시")
    })
    @PatchMapping("/{compartmentId}")
    public ResponseEntity<FridgeSlotResponse> updateCompartment(
            @PathVariable("compartmentId") UUID compartmentId,
            @Valid @RequestBody UpdateCompartmentConfigRequest request
    ) {
        FridgeSlotResponse response = fridgeAdminService.updateCompartment(compartmentId, request);
        return ResponseEntity.ok(response);
    }
}

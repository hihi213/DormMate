package com.dormmate.backend.modules.fridge.presentation;

import java.util.List;
import java.util.UUID;

import com.dormmate.backend.modules.fridge.presentation.dto.AddItemRequest;
import com.dormmate.backend.modules.fridge.presentation.dto.BundleListResponse;
import com.dormmate.backend.modules.fridge.presentation.dto.CreateBundleRequest;
import com.dormmate.backend.modules.fridge.presentation.dto.CreateBundleResponse;
import com.dormmate.backend.modules.fridge.presentation.dto.FridgeBundleResponse;
import com.dormmate.backend.modules.fridge.presentation.dto.FridgeItemResponse;
import com.dormmate.backend.modules.fridge.presentation.dto.FridgeSlotResponse;
import com.dormmate.backend.modules.fridge.presentation.dto.UpdateBundleRequest;
import com.dormmate.backend.modules.fridge.presentation.dto.UpdateItemRequest;
import com.dormmate.backend.modules.fridge.application.FridgeService;

import jakarta.validation.Valid;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/fridge")
public class FridgeController {

    private final FridgeService fridgeService;

    public FridgeController(FridgeService fridgeService) {
        this.fridgeService = fridgeService;
    }

    @GetMapping("/slots")
    public ResponseEntity<List<FridgeSlotResponse>> getSlots(
            @RequestParam(name = "floor", required = false) Integer floor,
            @RequestParam(name = "view", required = false) String view
    ) {
        return ResponseEntity.ok(fridgeService.getSlots(floor, view));
    }

    @GetMapping("/bundles")
    public ResponseEntity<BundleListResponse> getBundles(
            @RequestParam(name = "slotId", required = false) UUID slotId,
            @RequestParam(name = "owner", required = false) String owner,
            @RequestParam(name = "status", required = false) String status,
            @RequestParam(name = "search", required = false) String search,
            @RequestParam(name = "page", defaultValue = "0") int page,
            @RequestParam(name = "size", defaultValue = "20") int size
    ) {
        return ResponseEntity.ok(fridgeService.getBundles(slotId, owner, status, search, page, size));
    }

    @Operation(
            summary = "포장 생성",
            description = """
                    배정된 칸에 새로운 포장을 추가한다. \
                    허용량(`capacity`)을 초과하면 422 `CAPACITY_EXCEEDED`가 반환된다. \
                    데모 시나리오에서는 2층 A칸(`slotIndex` 0)만 설명용으로 허용량이 3으로 제한돼 있다.
                    """
    )
    @ApiResponses({
            @ApiResponse(responseCode = "201", description = "포장 생성 성공"),
            @ApiResponse(responseCode = "422", description = "허용량 초과 – detail 값이 `CAPACITY_EXCEEDED`")
    })
    @PostMapping("/bundles")
    public ResponseEntity<CreateBundleResponse> createBundle(@Valid @RequestBody CreateBundleRequest request) {
        return ResponseEntity.status(201).body(fridgeService.createBundle(request));
    }

    @GetMapping("/bundles/{bundleId}")
    public ResponseEntity<FridgeBundleResponse> getBundle(@PathVariable("bundleId") UUID bundleId) {
        return ResponseEntity.ok(fridgeService.getBundle(bundleId));
    }

    @PatchMapping("/bundles/{bundleId}")
    public ResponseEntity<FridgeBundleResponse> updateBundle(
            @PathVariable("bundleId") UUID bundleId,
            @Valid @RequestBody UpdateBundleRequest request
    ) {
        return ResponseEntity.ok(fridgeService.updateBundle(bundleId, request));
    }

    @DeleteMapping("/bundles/{bundleId}")
    public ResponseEntity<Void> deleteBundle(@PathVariable("bundleId") UUID bundleId) {
        fridgeService.deleteBundle(bundleId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/bundles/{bundleId}/items")
    public ResponseEntity<FridgeItemResponse> addItem(
            @PathVariable("bundleId") UUID bundleId,
            @Valid @RequestBody AddItemRequest request
    ) {
        return ResponseEntity.status(201).body(fridgeService.addItem(bundleId, request));
    }

    @PatchMapping("/items/{itemId}")
    public ResponseEntity<FridgeItemResponse> updateItem(
            @PathVariable("itemId") UUID itemId,
            @Valid @RequestBody UpdateItemRequest request
    ) {
        return ResponseEntity.ok(fridgeService.updateItem(itemId, request));
    }

    @DeleteMapping("/items/{itemId}")
    public ResponseEntity<Void> deleteItem(@PathVariable("itemId") UUID itemId) {
        fridgeService.deleteItem(itemId);
        return ResponseEntity.noContent().build();
    }
}

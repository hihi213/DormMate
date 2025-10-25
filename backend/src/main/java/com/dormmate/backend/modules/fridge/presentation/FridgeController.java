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
            @RequestParam(name = "slotCode", required = false) String slotCode,
            @RequestParam(name = "owner", required = false) String owner,
            @RequestParam(name = "status", required = false) String status,
            @RequestParam(name = "search", required = false) String search
    ) {
        return ResponseEntity.ok(fridgeService.getBundles(slotCode, owner, status, search));
    }

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

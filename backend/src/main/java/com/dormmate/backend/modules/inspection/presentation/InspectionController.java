package com.dormmate.backend.modules.inspection.presentation;

import java.util.List;
import java.util.UUID;

import com.dormmate.backend.modules.inspection.presentation.dto.InspectionActionRequest;
import com.dormmate.backend.modules.inspection.presentation.dto.InspectionScheduleResponse;
import com.dormmate.backend.modules.inspection.presentation.dto.InspectionSessionResponse;
import com.dormmate.backend.modules.inspection.presentation.dto.ReinspectRequest;
import com.dormmate.backend.modules.inspection.presentation.dto.StartInspectionRequest;
import com.dormmate.backend.modules.inspection.presentation.dto.SubmitInspectionRequest;
import com.dormmate.backend.modules.inspection.presentation.dto.UpdateInspectionSessionRequest;
import com.dormmate.backend.modules.inspection.application.InspectionService;

import jakarta.validation.Valid;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/fridge/inspections")
public class InspectionController {

    private final InspectionService inspectionService;

    public InspectionController(InspectionService inspectionService) {
        this.inspectionService = inspectionService;
    }

    @GetMapping
    public ResponseEntity<List<InspectionSessionResponse>> listSessions(
            @RequestParam(name = "slotId", required = false) UUID slotId,
            @RequestParam(name = "status", required = false) String status,
            @RequestParam(name = "limit", required = false) Integer limit
    ) {
        return ResponseEntity.ok(inspectionService.listSessions(slotId, status, limit));
    }

    @PostMapping
    public ResponseEntity<InspectionSessionResponse> startSession(@Valid @RequestBody StartInspectionRequest request) {
        return ResponseEntity.status(201).body(inspectionService.startSession(request));
    }

    @PatchMapping("/{sessionId}")
    public ResponseEntity<InspectionSessionResponse> updateSession(
            @PathVariable("sessionId") UUID sessionId,
            @Valid @RequestBody UpdateInspectionSessionRequest request
    ) {
        return ResponseEntity.ok(inspectionService.patchSession(sessionId, request));
    }

    @GetMapping("/active")
    public ResponseEntity<InspectionSessionResponse> getActiveSession(
            @RequestParam(name = "floor", required = false) Integer floor
    ) {
        return inspectionService.findActiveSession(floor)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.noContent().build());
    }

    @GetMapping("/{sessionId}")
    public ResponseEntity<InspectionSessionResponse> getSession(@PathVariable("sessionId") UUID sessionId) {
        return ResponseEntity.ok(inspectionService.getSession(sessionId));
    }

    @DeleteMapping("/{sessionId}")
    public ResponseEntity<Void> cancelSession(@PathVariable("sessionId") UUID sessionId) {
        inspectionService.cancelSession(sessionId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{sessionId}/actions")
    public ResponseEntity<InspectionSessionResponse> recordActions(
            @PathVariable("sessionId") UUID sessionId,
            @Valid @RequestBody InspectionActionRequest request
    ) {
        return ResponseEntity.ok(inspectionService.recordActions(sessionId, request));
    }

    @PostMapping("/{sessionId}/submit")
    public ResponseEntity<InspectionSessionResponse> submitSession(
            @PathVariable("sessionId") UUID sessionId,
            @RequestBody(required = false) SubmitInspectionRequest request
    ) {
        return ResponseEntity.ok(inspectionService.submitSession(sessionId, request));
    }

    @PostMapping("/{sessionId}/notifications/resend")
    public ResponseEntity<InspectionSessionResponse> resendNotifications(@PathVariable("sessionId") UUID sessionId) {
        return ResponseEntity.ok(inspectionService.resendInspectionNotifications(sessionId));
    }

    @PostMapping("/{sessionId}/reinspect")
    public ResponseEntity<InspectionScheduleResponse> requestReinspection(
            @PathVariable("sessionId") UUID sessionId,
            @RequestBody(required = false) ReinspectRequest request
    ) {
        return ResponseEntity.status(201).body(inspectionService.requestReinspection(sessionId, request));
    }
}

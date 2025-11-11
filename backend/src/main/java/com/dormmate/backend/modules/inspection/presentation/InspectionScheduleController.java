package com.dormmate.backend.modules.inspection.presentation;

import java.util.List;
import java.util.UUID;

import com.dormmate.backend.modules.inspection.application.InspectionScheduleService;
import com.dormmate.backend.modules.inspection.presentation.dto.CreateInspectionScheduleRequest;
import com.dormmate.backend.modules.inspection.presentation.dto.InspectionScheduleResponse;
import com.dormmate.backend.modules.inspection.presentation.dto.UpdateInspectionScheduleRequest;

import jakarta.validation.Valid;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/fridge/inspection-schedules")
public class InspectionScheduleController {

    private final InspectionScheduleService inspectionScheduleService;

    public InspectionScheduleController(InspectionScheduleService inspectionScheduleService) {
        this.inspectionScheduleService = inspectionScheduleService;
    }

    @GetMapping
    public ResponseEntity<List<InspectionScheduleResponse>> listSchedules(
            @RequestParam(name = "status", required = false) String status,
            @RequestParam(name = "limit", required = false) Integer limit,
            @RequestParam(name = "floor", required = false) Integer floor,
            @RequestParam(name = "compartmentId", required = false) List<UUID> compartmentIds
    ) {
        return ResponseEntity.ok(inspectionScheduleService.listSchedules(status, limit, floor, compartmentIds));
    }

    @GetMapping("/next")
    public ResponseEntity<InspectionScheduleResponse> getNextSchedule() {
        return inspectionScheduleService.getNextSchedule()
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.noContent().build());
    }

    @PostMapping
    public ResponseEntity<InspectionScheduleResponse> createSchedule(
            @Valid @RequestBody CreateInspectionScheduleRequest request
    ) {
        return ResponseEntity.status(201).body(inspectionScheduleService.createSchedule(request));
    }

    @PatchMapping("/{scheduleId}")
    public ResponseEntity<InspectionScheduleResponse> updateSchedule(
            @PathVariable("scheduleId") UUID scheduleId,
            @Valid @RequestBody UpdateInspectionScheduleRequest request
    ) {
        return ResponseEntity.ok(inspectionScheduleService.updateSchedule(scheduleId, request));
    }

    @DeleteMapping("/{scheduleId}")
    public ResponseEntity<Void> deleteSchedule(@PathVariable("scheduleId") UUID scheduleId) {
        inspectionScheduleService.deleteSchedule(scheduleId);
        return ResponseEntity.noContent().build();
    }
}

package com.dormmate.backend.modules.admin.presentation;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import com.dormmate.backend.global.security.SecurityUtils;
import com.dormmate.backend.modules.admin.application.ResidentLifecycleService;

@RestController
@RequestMapping("/admin/resident-slots")
public class ResidentLifecycleController {
    private final ResidentLifecycleService service;
    public ResidentLifecycleController(ResidentLifecycleService service) { this.service = service; }
    @GetMapping public List<Map<String,Object>> list() { return service.listSlots(); }
    @PostMapping("/{id}/check-in")
    public ResponseEntity<Void> checkIn(@PathVariable UUID id, @Valid @RequestBody CheckIn request) {
        service.checkIn(id, request.name(), request.email(), request.reason(), SecurityUtils.getCurrentUserId());
        return ResponseEntity.noContent().build();
    }
    @PostMapping("/{id}/check-out")
    public ResponseEntity<Void> checkOut(@PathVariable UUID id, @Valid @RequestBody Action request) {
        service.checkOut(id, request.userId(), request.reason(), SecurityUtils.getCurrentUserId());
        return ResponseEntity.noContent().build();
    }
    @PostMapping("/{id}/reset-password")
    public ResponseEntity<Void> reset(@PathVariable UUID id, @Valid @RequestBody Action request) {
        service.resetPassword(id, request.userId(), request.reason(), SecurityUtils.getCurrentUserId());
        return ResponseEntity.noContent().build();
    }
    public record CheckIn(@NotBlank @Size(max=100) String name, @Size(max=320) String email,
                          @NotBlank @Size(max=500) String reason) {}
    public record Action(@NotNull UUID userId, @NotBlank @Size(max=500) String reason) {}
}

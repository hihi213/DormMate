package com.dormmate.backend.modules.admin.presentation;

import java.time.LocalTime;
import java.time.format.DateTimeParseException;
import java.util.Objects;
import java.util.UUID;

import jakarta.validation.Valid;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import com.dormmate.backend.global.error.ProblemException;
import com.dormmate.backend.global.security.SecurityUtils;
import com.dormmate.backend.modules.admin.application.AdminMutationService;
import com.dormmate.backend.modules.admin.application.AdminMutationService.UpdatePoliciesCommand;
import com.dormmate.backend.modules.admin.application.AdminReadService;
import com.dormmate.backend.modules.admin.presentation.dto.AdminDashboardResponse;
import com.dormmate.backend.modules.admin.presentation.dto.AdminFridgeOwnershipIssuesResponse;
import com.dormmate.backend.modules.admin.presentation.dto.AdminPoliciesResponse;
import com.dormmate.backend.modules.admin.presentation.dto.AdminUsersResponse;
import com.dormmate.backend.modules.admin.presentation.dto.AdminUserStatusFilter;
import com.dormmate.backend.modules.admin.presentation.dto.RoleChangeRequest;
import com.dormmate.backend.modules.admin.presentation.dto.UpdateAdminPoliciesRequest;
import com.dormmate.backend.modules.admin.presentation.dto.UpdateUserStatusRequest;

@RestController
@RequestMapping("/admin")
public class AdminDashboardController {

    private final AdminReadService adminReadService;
    private final AdminMutationService adminMutationService;

    public AdminDashboardController(
            AdminReadService adminReadService,
            AdminMutationService adminMutationService
    ) {
        this.adminReadService = adminReadService;
        this.adminMutationService = adminMutationService;
    }

    @GetMapping("/dashboard")
    public ResponseEntity<AdminDashboardResponse> getDashboard() {
        return ResponseEntity.ok(adminReadService.getDashboard());
    }

    @GetMapping("/fridge/issues")
    public ResponseEntity<AdminFridgeOwnershipIssuesResponse> getFridgeOwnershipIssues(
            @RequestParam(name = "page", defaultValue = "0") int page,
            @RequestParam(name = "size", defaultValue = "20") int size,
            @RequestParam(name = "ownerId", required = false) UUID ownerId
    ) {
        return ResponseEntity.ok(adminReadService.getFridgeOwnershipIssues(page, size, ownerId));
    }

    @GetMapping("/users")
    public ResponseEntity<AdminUsersResponse> getUsers(
            @RequestParam(name = "status", defaultValue = "ACTIVE") String status,
            @RequestParam(name = "floor", required = false) String floor,
            @RequestParam(name = "floorManagerOnly", defaultValue = "false") boolean floorManagerOnly,
            @RequestParam(name = "search", required = false) String search,
            @RequestParam(name = "page", defaultValue = "0") int page,
            @RequestParam(name = "size", defaultValue = "20") int size
    ) {
        AdminUserStatusFilter filter;
        try {
            filter = AdminUserStatusFilter.from(status);
        } catch (IllegalArgumentException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, ex.getMessage(), ex);
        }
        Integer floorFilter = parseFloor(floor);
        AdminReadService.AdminUsersQuery query = new AdminReadService.AdminUsersQuery(
                filter,
                floorFilter,
                floorManagerOnly,
                search,
                page,
                size
        );
        return ResponseEntity.ok(adminReadService.getUsers(query));
    }

    @PostMapping("/users/{userId}/roles/floor-manager")
    public ResponseEntity<Void> promoteFloorManager(
            @PathVariable UUID userId,
            @Valid @RequestBody RoleChangeRequest request
    ) {
        adminMutationService.promoteToFloorManager(userId, SecurityUtils.getCurrentUserId(), request.reason());
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/users/{userId}/roles/floor-manager")
    public ResponseEntity<Void> demoteFloorManager(
            @PathVariable UUID userId,
            @Valid @RequestBody RoleChangeRequest request
    ) {
        adminMutationService.demoteFloorManager(userId, SecurityUtils.getCurrentUserId(), request.reason());
        return ResponseEntity.noContent().build();
    }

    @PatchMapping("/users/{userId}/status")
    public ResponseEntity<Void> updateUserStatus(
            @PathVariable UUID userId,
            @Valid @RequestBody UpdateUserStatusRequest request
    ) {
        String normalized = Objects.requireNonNull(request.status(), "status").trim().toUpperCase();
        if (!"INACTIVE".equals(normalized)) {
            throw new ProblemException(HttpStatus.BAD_REQUEST, "admin.unsupported_status", "지원하지 않는 상태 변경입니다.");
        }
        adminMutationService.deactivateUser(userId, SecurityUtils.getCurrentUserId(), request.reason());
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/policies")
    public ResponseEntity<AdminPoliciesResponse> getPolicies() {
        return ResponseEntity.ok(adminReadService.getPolicies());
    }

    @PutMapping("/policies")
    public ResponseEntity<Void> updatePolicies(@Valid @RequestBody UpdateAdminPoliciesRequest request) {
        LocalTime batchTime;
        try {
            batchTime = LocalTime.parse(request.notification().batchTime());
        } catch (DateTimeParseException ex) {
            throw new ProblemException(HttpStatus.BAD_REQUEST, "admin.invalid_batch_time", "배치 시각은 HH:mm 형식이어야 합니다.");
        }

        UpdateAdminPoliciesRequest.NotificationPolicy notificationSettings =
                Objects.requireNonNull(request.notification(), "notification settings");
        UpdateAdminPoliciesRequest.PenaltyPolicy penaltySettings =
                Objects.requireNonNull(request.penalty(), "penalty settings");

        adminMutationService.updatePolicies(new UpdatePoliciesCommand(
                batchTime,
                notificationSettings.dailyLimit(),
                notificationSettings.ttlHours(),
                penaltySettings.limit(),
                penaltySettings.template()
        ));
        return ResponseEntity.noContent().build();
    }

    private Integer parseFloor(String floor) {
        if (floor == null || floor.isBlank()) {
            return null;
        }
        String normalized = floor.trim();
        if ("ALL".equalsIgnoreCase(normalized)) {
            return null;
        }
        try {
            int parsed = Integer.parseInt(normalized);
            return parsed;
        } catch (NumberFormatException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "층 파라미터가 올바르지 않습니다.", ex);
        }
    }
}

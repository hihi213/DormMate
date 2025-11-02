package com.dormmate.backend.modules.admin.presentation;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.dormmate.backend.modules.admin.application.AdminReadService;
import com.dormmate.backend.modules.admin.presentation.dto.AdminDashboardResponse;
import com.dormmate.backend.modules.admin.presentation.dto.AdminPoliciesResponse;
import com.dormmate.backend.modules.admin.presentation.dto.AdminResourceResponse;
import com.dormmate.backend.modules.admin.presentation.dto.AdminUsersResponse;

@RestController
@RequestMapping("/admin")
public class AdminDashboardController {

    private final AdminReadService adminReadService;

    public AdminDashboardController(AdminReadService adminReadService) {
        this.adminReadService = adminReadService;
    }

    @GetMapping("/dashboard")
    public ResponseEntity<AdminDashboardResponse> getDashboard() {
        return ResponseEntity.ok(adminReadService.getDashboard());
    }

    @GetMapping("/resources")
    public ResponseEntity<AdminResourceResponse> getResources() {
        return ResponseEntity.ok(adminReadService.getResources());
    }

    @GetMapping("/users")
    public ResponseEntity<AdminUsersResponse> getUsers() {
        return ResponseEntity.ok(adminReadService.getUsers());
    }

    @GetMapping("/policies")
    public ResponseEntity<AdminPoliciesResponse> getPolicies() {
        return ResponseEntity.ok(adminReadService.getPolicies());
    }
}

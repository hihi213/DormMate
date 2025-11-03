package com.dormmate.backend.modules.admin.infrastructure;

import java.util.UUID;

import com.dormmate.backend.modules.admin.domain.AdminPolicy;

import org.springframework.data.jpa.repository.JpaRepository;

public interface AdminPolicyRepository extends JpaRepository<AdminPolicy, UUID> {
}

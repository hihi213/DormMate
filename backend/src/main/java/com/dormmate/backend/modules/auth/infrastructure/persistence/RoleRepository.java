package com.dormmate.backend.modules.auth.infrastructure.persistence;

import com.dormmate.backend.modules.auth.domain.Role;

import org.springframework.data.jpa.repository.JpaRepository;

public interface RoleRepository extends JpaRepository<Role, String> {
}

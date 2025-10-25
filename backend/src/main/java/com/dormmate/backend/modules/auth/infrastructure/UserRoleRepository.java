package com.dormmate.backend.modules.auth.infrastructure;

import java.util.List;
import java.util.UUID;

import com.dormmate.backend.modules.auth.domain.UserRole;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface UserRoleRepository extends JpaRepository<UserRole, UUID> {

    @Query("select ur from UserRole ur join fetch ur.role where ur.dormUser.id = :userId and ur.revokedAt is null")
    List<UserRole> findActiveRoles(@Param("userId") UUID userId);
}

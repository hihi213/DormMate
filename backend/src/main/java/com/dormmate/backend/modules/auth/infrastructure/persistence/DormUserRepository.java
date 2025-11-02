package com.dormmate.backend.modules.auth.infrastructure.persistence;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.dormmate.backend.modules.auth.domain.DormUser;
import com.dormmate.backend.modules.auth.domain.DormUserStatus;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface DormUserRepository extends JpaRepository<DormUser, UUID> {

    @Query("select du from DormUser du where lower(du.loginId) = lower(:loginId)")
    Optional<DormUser> findByLoginIdIgnoreCase(@Param("loginId") String loginId);

    @Query("""
            select distinct du
              from DormUser du
              left join fetch du.roles ur
              left join fetch ur.role r
             where du.status = :status
            """)
    List<DormUser> findActiveUsersWithRoles(@Param("status") DormUserStatus status);
}

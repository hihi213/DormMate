package com.dormmate.backend.modules.auth.infrastructure.persistence;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.dormmate.backend.modules.auth.domain.DormUser;
import com.dormmate.backend.modules.auth.domain.DormUserStatus;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface DormUserRepository extends JpaRepository<DormUser, UUID> {

    @Query("select du from DormUser du where lower(du.loginId) = lower(:loginId)")
    Optional<DormUser> findByLoginIdIgnoreCase(@Param("loginId") String loginId);

    @EntityGraph(attributePaths = {
            "roles",
            "roles.role"
    })
    @Query("""
            select distinct du
              from DormUser du
             where (:status is null or du.status = :status)
            """)
    List<DormUser> findUsersWithAssociations(@Param("status") DormUserStatus status);
}

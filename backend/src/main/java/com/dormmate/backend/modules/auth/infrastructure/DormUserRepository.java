package com.dormmate.backend.modules.auth.infrastructure;

import java.util.Optional;
import java.util.UUID;

import com.dormmate.backend.modules.auth.domain.DormUser;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface DormUserRepository extends JpaRepository<DormUser, UUID> {

    @Query("select du from DormUser du where lower(du.loginId) = lower(:loginId)")
    Optional<DormUser> findByLoginIdIgnoreCase(@Param("loginId") String loginId);
}

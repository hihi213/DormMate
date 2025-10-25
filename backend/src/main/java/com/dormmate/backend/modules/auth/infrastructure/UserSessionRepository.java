package com.dormmate.backend.modules.auth.infrastructure;

import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;

import com.dormmate.backend.modules.auth.domain.UserSession;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface UserSessionRepository extends JpaRepository<UserSession, UUID> {

    @Query("select us from UserSession us join fetch us.dormUser where us.refreshToken = :refreshToken and us.revokedAt is null")
    Optional<UserSession> findActiveByRefreshToken(@Param("refreshToken") String refreshToken);

    @Modifying
    @Query("update UserSession us set us.revokedAt = :revokedAt, us.revokedReason = :reason where us.refreshToken = :refreshToken")
    int revokeByRefreshToken(@Param("refreshToken") String refreshToken,
                             @Param("revokedAt") OffsetDateTime revokedAt,
                             @Param("reason") String reason);
}

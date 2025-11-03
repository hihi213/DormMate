package com.dormmate.backend.modules.auth.infrastructure.persistence;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.dormmate.backend.modules.auth.domain.UserSession;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface UserSessionRepository extends JpaRepository<UserSession, UUID> {

    @Modifying
    @Query("update UserSession us set us.revokedAt = :revokedAt, us.revokedReason = :reason where us.refreshTokenHash = :refreshTokenHash")
    int revokeByRefreshTokenHash(@Param("refreshTokenHash") String refreshTokenHash,
                             @Param("revokedAt") OffsetDateTime revokedAt,
                             @Param("reason") String reason);

    Optional<UserSession> findByRefreshTokenHash(String refreshTokenHash);

    @Modifying
    @Query("""
            update UserSession us
               set us.revokedAt = :revokedAt,
                   us.revokedReason = :reason
             where us.dormUser.id = :userId
               and us.revokedAt is null
               and us.expiresAt <= :now
            """)
    int revokeExpiredSessions(@Param("userId") UUID userId,
                              @Param("now") OffsetDateTime now,
                              @Param("revokedAt") OffsetDateTime revokedAt,
                              @Param("reason") String reason);
    @Query("""
            select us
              from UserSession us
              join fetch us.dormUser du
             where us.revokedAt is null
               and (us.expiresAt is null or us.expiresAt > :now)
               and du.id in :userIds
            """)
    List<UserSession> findActiveSessionsByUserIds(
            @Param("userIds") Iterable<UUID> userIds,
            @Param("now") OffsetDateTime now
    );
}

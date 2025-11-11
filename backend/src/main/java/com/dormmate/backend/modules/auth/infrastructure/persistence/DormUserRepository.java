package com.dormmate.backend.modules.auth.infrastructure.persistence;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.dormmate.backend.modules.auth.domain.DormUser;
import com.dormmate.backend.modules.auth.domain.DormUserStatus;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface DormUserRepository extends JpaRepository<DormUser, UUID> {

    @Query("select du from DormUser du where lower(du.loginId) = lower(:loginId)")
    Optional<DormUser> findByLoginIdIgnoreCase(@Param("loginId") String loginId);

    @Query("""
            select du.id
              from DormUser du
              left join RoomAssignment ra
                     on ra.dormUser = du
                    and ra.releasedAt is null
              left join ra.room room
            where (:status is null or du.status = :status)
              and not exists (
                    select 1
                      from UserRole adminRole
                     where adminRole.dormUser = du
                       and adminRole.revokedAt is null
                       and upper(adminRole.role.code) = 'ADMIN'
              )
              and (:floor is null or room.floor = :floor)
              and (
                    :searchPattern is null
                 or lower(du.fullName) like :searchPattern
                 or lower(du.loginId) like :searchPattern
               )
              and (
                    :floorManagerOnly = false
                    or exists (
                        select 1
                          from UserRole ur
                         where ur.dormUser = du
                           and ur.revokedAt is null
                           and upper(ur.role.code) = 'FLOOR_MANAGER'
                    )
               )
             order by coalesce(room.floor, 32767),
                      coalesce(room.roomNumber, 'ZZZZ'),
                      coalesce(ra.personalNo, 32767),
                      lower(du.fullName)
            """)
    Page<UUID> findUserIdsByFilters(
            @Param("status") DormUserStatus status,
            @Param("floor") Integer floor,
            @Param("floorManagerOnly") boolean floorManagerOnly,
            @Param("searchPattern") String searchPattern,
            Pageable pageable
    );

    @EntityGraph(attributePaths = {
            "roles",
            "roles.role"
    })
    @Query("""
            select du
              from DormUser du
             where du.id in :ids
            """)
    List<DormUser> findByIdsWithRoles(@Param("ids") Collection<UUID> ids);

    @Query("""
            select case when count(ur) > 0 then true else false end
              from UserRole ur
             where ur.dormUser.id = :userId
               and ur.revokedAt is null
               and upper(ur.role.code) = 'ADMIN'
            """)
    boolean existsActiveAdminRole(@Param("userId") UUID userId);

    @Query("""
            select distinct ur.dormUser.id
              from UserRole ur
              join ur.dormUser du
             where ur.revokedAt is null
               and du.status = com.dormmate.backend.modules.auth.domain.DormUserStatus.ACTIVE
               and upper(ur.role.code) = 'ADMIN'
            """)
    List<UUID> findActiveAdminIds();
}

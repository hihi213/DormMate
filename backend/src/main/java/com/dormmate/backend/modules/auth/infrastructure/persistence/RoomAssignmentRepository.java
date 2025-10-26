package com.dormmate.backend.modules.auth.infrastructure.persistence;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.dormmate.backend.modules.auth.domain.RoomAssignment;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface RoomAssignmentRepository extends JpaRepository<RoomAssignment, UUID> {

    @Query("select ra from RoomAssignment ra join fetch ra.room where ra.dormUser.id = :userId and ra.releasedAt is null")
    Optional<RoomAssignment> findActiveAssignment(@Param("userId") UUID userId);

    @Query("select ra from RoomAssignment ra join fetch ra.room where ra.room.id = :roomId and ra.releasedAt is null")
    List<RoomAssignment> findActiveAssignmentsByRoom(@Param("roomId") UUID roomId);
}

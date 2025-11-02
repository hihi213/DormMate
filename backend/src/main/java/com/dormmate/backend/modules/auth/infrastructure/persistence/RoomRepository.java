package com.dormmate.backend.modules.auth.infrastructure.persistence;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

import com.dormmate.backend.modules.auth.domain.Room;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface RoomRepository extends JpaRepository<Room, UUID> {

    @Query("select r from Room r where r.floor = :floor order by r.roomNumber asc")
    List<Room> findByFloorOrderByRoomNumber(@Param("floor") short floor);

    List<Room> findByIdIn(Collection<UUID> ids);
}

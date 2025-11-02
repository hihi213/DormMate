package com.dormmate.backend.modules.fridge.application;

import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import com.dormmate.backend.modules.auth.domain.Room;
import com.dormmate.backend.modules.auth.infrastructure.persistence.RoomRepository;
import com.dormmate.backend.modules.fridge.domain.CompartmentRoomAccess;
import com.dormmate.backend.modules.fridge.domain.CompartmentType;
import com.dormmate.backend.modules.fridge.domain.FridgeCompartment;
import com.dormmate.backend.modules.fridge.domain.FridgeUnit;
import com.dormmate.backend.modules.fridge.domain.LabelFormatter;
import com.dormmate.backend.modules.fridge.infrastructure.persistence.CompartmentRoomAccessRepository;
import com.dormmate.backend.modules.fridge.infrastructure.persistence.FridgeCompartmentRepository;
import com.dormmate.backend.modules.fridge.presentation.dto.admin.ReallocationApplyRequest;
import com.dormmate.backend.modules.fridge.presentation.dto.admin.ReallocationApplyRequest.CompartmentAllocationInput;
import com.dormmate.backend.modules.fridge.presentation.dto.admin.ReallocationApplyResponse;
import com.dormmate.backend.modules.fridge.presentation.dto.admin.ReallocationPreviewRequest;
import com.dormmate.backend.modules.fridge.presentation.dto.admin.ReallocationPreviewResponse;
import com.dormmate.backend.modules.fridge.presentation.dto.admin.ReallocationPreviewResponse.CompartmentAllocationView;
import com.dormmate.backend.modules.fridge.presentation.dto.admin.ReallocationPreviewResponse.RoomSummary;
import com.dormmate.backend.modules.inspection.domain.InspectionStatus;
import com.dormmate.backend.modules.inspection.infrastructure.persistence.InspectionSessionRepository;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@Transactional
public class FridgeReallocationService {

    private final FridgeCompartmentRepository fridgeCompartmentRepository;
    private final CompartmentRoomAccessRepository compartmentRoomAccessRepository;
    private final RoomRepository roomRepository;
    private final InspectionSessionRepository inspectionSessionRepository;
    private final Clock clock;

    public FridgeReallocationService(
            FridgeCompartmentRepository fridgeCompartmentRepository,
            CompartmentRoomAccessRepository compartmentRoomAccessRepository,
            RoomRepository roomRepository,
            InspectionSessionRepository inspectionSessionRepository,
            Clock clock
    ) {
        this.fridgeCompartmentRepository = fridgeCompartmentRepository;
        this.compartmentRoomAccessRepository = compartmentRoomAccessRepository;
        this.roomRepository = roomRepository;
        this.inspectionSessionRepository = inspectionSessionRepository;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public ReallocationPreviewResponse preview(ReallocationPreviewRequest request) {
        short floor = request.floor();
        List<Room> rooms = roomRepository.findByFloorOrderByRoomNumber(floor);
        if (rooms.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "ROOMS_NOT_FOUND_ON_FLOOR");
        }

        List<FridgeCompartment> compartments = fridgeCompartmentRepository.findByFloorWithAccesses(floor).stream()
                .filter(compartment -> compartment.getFridgeUnit().getStatus().isActive())
                .sorted(Comparator.comparingInt(FridgeCompartment::getSlotIndex))
                .toList();

        if (compartments.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "COMPARTMENTS_NOT_FOUND_ON_FLOOR");
        }

        Set<UUID> compartmentIds = compartments.stream()
                .map(FridgeCompartment::getId)
                .collect(Collectors.toSet());

        Set<UUID> compartmentsUnderInspection = inspectionSessionRepository.findByStatus(InspectionStatus.IN_PROGRESS).stream()
                .map(session -> session.getFridgeCompartment().getId())
                .filter(compartmentIds::contains)
                .collect(Collectors.toSet());

        List<RoomSummary> roomSummaries = rooms.stream()
                .map(room -> new RoomSummary(room.getId(), room.getRoomNumber(), room.getRoomType().name(), room.getFloor()))
                .toList();

        List<FridgeCompartment> chillCompartments = compartments.stream()
                .filter(fc -> fc.getCompartmentType() == CompartmentType.CHILL && fc.getStatus().isActive())
                .toList();

        List<UUID> sortedRoomIds = rooms.stream().map(Room::getId).toList();
        Map<UUID, List<UUID>> recommended = buildRecommendedAssignments(sortedRoomIds, chillCompartments);

        List<CompartmentAllocationView> allocations = compartments.stream()
                .map(compartment -> toAllocationView(compartment, recommended, rooms, compartmentsUnderInspection))
                .toList();

        int totalChill = (int) allocations.stream().filter(a -> a.compartmentType() == CompartmentType.CHILL).count();

        return new ReallocationPreviewResponse(
                floor,
                roomSummaries,
                allocations,
                totalChill
        );
    }

    public ReallocationApplyResponse apply(ReallocationApplyRequest request) {
        short floor = request.floor();
        List<Room> rooms = roomRepository.findByFloorOrderByRoomNumber(floor);
        if (rooms.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "ROOMS_NOT_FOUND_ON_FLOOR");
        }
        Map<UUID, Room> roomMap = rooms.stream().collect(Collectors.toMap(Room::getId, room -> room));

        List<UUID> requestedCompartmentIds = request.allocations().stream()
                .map(CompartmentAllocationInput::compartmentId)
                .toList();
        if (requestedCompartmentIds.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "ALLOCATIONS_REQUIRED");
        }

        List<FridgeCompartment> compartments = fridgeCompartmentRepository.findByIdInForUpdate(requestedCompartmentIds);
        if (compartments.size() != requestedCompartmentIds.size()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "COMPARTMENT_NOT_FOUND");
        }

        Map<UUID, FridgeCompartment> compartmentLookup = compartments.stream()
                .collect(Collectors.toMap(FridgeCompartment::getId, fc -> fc));

        Set<UUID> inProgressCompartmentIds = inspectionSessionRepository.findByStatus(InspectionStatus.IN_PROGRESS).stream()
                .map(session -> session.getFridgeCompartment().getId())
                .filter(compartmentLookup::containsKey)
                .collect(Collectors.toSet());

        // Validate floor matching and active units
        for (FridgeCompartment compartment : compartments) {
            FridgeUnit unit = compartment.getFridgeUnit();
            if (unit.getFloorNo() != floor) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "COMPARTMENT_NOT_ON_FLOOR");
            }
            if (!unit.getStatus().isActive()) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "COMPARTMENT_UNIT_INACTIVE");
            }
        }

        Set<UUID> floorRoomIds = new HashSet<>(roomMap.keySet());

        Map<UUID, List<UUID>> requestedAssignments = new HashMap<>();
        for (CompartmentAllocationInput input : request.allocations()) {
            FridgeCompartment compartment = Optional.ofNullable(compartmentLookup.get(input.compartmentId()))
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "COMPARTMENT_NOT_FOUND"));
            List<UUID> roomIds = input.roomIds() == null ? List.of() : input.roomIds();
            if (compartment.getCompartmentType() == CompartmentType.CHILL) {
                validateExclusiveRooms(roomIds, floorRoomIds, compartment);
            } else {
                validateSharedRooms(roomIds, floorRoomIds, compartment);
            }
            roomIds.forEach(roomId -> {
                if (!roomMap.containsKey(roomId)) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "ROOM_NOT_ON_FLOOR");
                }
            });
            requestedAssignments.put(compartment.getId(), List.copyOf(roomIds));
        }

        ensureChillCoverage(compartments, requestedAssignments, floorRoomIds);

        OffsetDateTime now = OffsetDateTime.now(clock);
        int releasedCount = 0;
        int createdCount = 0;

        for (FridgeCompartment compartment : compartments) {
            if (!compartment.getStatus().isActive()) {
                continue;
            }
            if (compartment.isLocked() || inProgressCompartmentIds.contains(compartment.getId())) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "COMPARTMENT_IN_USE");
            }
            List<CompartmentRoomAccess> activeAccesses = compartmentRoomAccessRepository
                    .findByFridgeCompartmentIdAndReleasedAtIsNullOrderByAssignedAtAsc(compartment.getId());
            for (CompartmentRoomAccess access : activeAccesses) {
                access.setReleasedAt(now);
                releasedCount++;
            }
            if (!activeAccesses.isEmpty()) {
                compartmentRoomAccessRepository.saveAll(activeAccesses);
            }

            List<UUID> roomIds = requestedAssignments.getOrDefault(compartment.getId(), List.of());
            List<CompartmentRoomAccess> newAccesses = new ArrayList<>();
            for (UUID roomId : roomIds) {
                Room room = roomMap.get(roomId);
                CompartmentRoomAccess access = new CompartmentRoomAccess();
                access.setFridgeCompartment(compartment);
                access.setRoom(room);
                access.setAssignedAt(now);
                newAccesses.add(access);
            }
            if (!newAccesses.isEmpty()) {
                compartmentRoomAccessRepository.saveAll(newAccesses);
                createdCount += newAccesses.size();
            }
        }

        return new ReallocationApplyResponse(
                floor,
                compartments.size(),
                releasedCount,
                createdCount,
                now
        );
    }

    private Map<UUID, List<UUID>> buildRecommendedAssignments(List<UUID> roomIds, List<FridgeCompartment> chillCompartments) {
        Map<UUID, List<UUID>> result = new HashMap<>();
        if (chillCompartments.isEmpty()) {
            return result;
        }

        List<FridgeCompartment> sortedCompartments = chillCompartments.stream()
                .sorted(Comparator.comparingInt(FridgeCompartment::getSlotIndex))
                .toList();

        int totalRooms = roomIds.size();
        int baseSize = totalRooms / sortedCompartments.size();
        int remainder = totalRooms % sortedCompartments.size();

        int cursor = 0;
        for (int i = 0; i < sortedCompartments.size(); i++) {
            int count = baseSize + (i < remainder ? 1 : 0);
            int end = Math.min(cursor + count, roomIds.size());
            List<UUID> sub = roomIds.subList(cursor, end);
            result.put(sortedCompartments.get(i).getId(), List.copyOf(sub));
            cursor = end;
        }
        return result;
    }

    private CompartmentAllocationView toAllocationView(
            FridgeCompartment compartment,
            Map<UUID, List<UUID>> recommended,
            List<Room> rooms,
            Set<UUID> compartmentsUnderInspection
    ) {
        List<UUID> current = compartment.getRoomAccesses().stream()
                .filter(CompartmentRoomAccess::isActive)
                .map(access -> access.getRoom().getId())
                .toList();
        List<UUID> suggested;
        if (compartment.getCompartmentType() == CompartmentType.CHILL) {
            suggested = recommended.getOrDefault(compartment.getId(), List.of());
        } else {
            suggested = rooms.stream().map(Room::getId).toList();
        }

        List<String> warnings = new ArrayList<>();
        if (!compartment.getStatus().isActive()) {
            warnings.add("INACTIVE_COMPARTMENT");
        }
        if (compartment.isLocked()) {
            warnings.add("COMPARTMENT_LOCKED");
        }
        if (compartmentsUnderInspection.contains(compartment.getId())) {
            warnings.add("INSPECTION_IN_PROGRESS");
        }

        return new CompartmentAllocationView(
                compartment.getId(),
                compartment.getFridgeUnit().getId(),
                compartment.getSlotIndex(),
                LabelFormatter.toSlotLetter(compartment.getSlotIndex()),
                compartment.getCompartmentType(),
                compartment.getStatus(),
                compartment.isLocked(),
                current,
                suggested,
                warnings
        );
    }

    private void validateExclusiveRooms(List<UUID> roomIds, Set<UUID> floorRoomIds, FridgeCompartment compartment) {
        if (roomIds.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "EXCLUSIVE_COMPARTMENT_REQUIRES_ROOMS");
        }
        Set<UUID> duplicates = findDuplicates(roomIds);
        if (!duplicates.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "DUPLICATE_ROOM_ASSIGNMENT");
        }
        for (UUID roomId : roomIds) {
            if (!floorRoomIds.contains(roomId)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "ROOM_NOT_ON_FLOOR");
            }
        }
    }

    private void validateSharedRooms(List<UUID> roomIds, Set<UUID> floorRoomIds, FridgeCompartment compartment) {
        if (roomIds.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "SHARED_COMPARTMENT_REQUIRES_ROOMS");
        }
        Set<UUID> unique = new HashSet<>(roomIds);
        if (!unique.equals(floorRoomIds)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "SHARED_COMPARTMENT_MUST_INCLUDE_ALL_ROOMS");
        }
    }

    private void ensureChillCoverage(
            List<FridgeCompartment> compartments,
            Map<UUID, List<UUID>> requestedAssignments,
            Set<UUID> floorRoomIds
    ) {
        Set<UUID> coverage = new HashSet<>();
        for (FridgeCompartment compartment : compartments) {
            if (compartment.getCompartmentType() != CompartmentType.CHILL) {
                continue;
            }
            if (!compartment.getStatus().isActive()) {
                continue;
            }
            List<UUID> rooms = requestedAssignments.get(compartment.getId());
            if (rooms == null || rooms.isEmpty()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "CHILL_COMPARTMENT_MISSING_ASSIGNMENTS");
            }
            for (UUID roomId : rooms) {
                if (!coverage.add(roomId)) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "ROOM_ASSIGNED_MULTIPLE_COMPARTMENTS");
                }
            }
        }
        if (!coverage.equals(floorRoomIds)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "ROOM_COVERAGE_MISMATCH");
        }
    }

    private Set<UUID> findDuplicates(List<UUID> values) {
        Set<UUID> seen = new HashSet<>();
        return values.stream()
                .filter(value -> !seen.add(value))
                .collect(Collectors.toSet());
    }
}

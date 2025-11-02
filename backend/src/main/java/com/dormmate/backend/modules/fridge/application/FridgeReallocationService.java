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

import static org.springframework.http.HttpStatus.BAD_REQUEST;
import static org.springframework.http.HttpStatus.CONFLICT;
import static org.springframework.http.HttpStatus.NOT_FOUND;

import com.dormmate.backend.global.error.ProblemException;
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
            throw problem(NOT_FOUND, "ROOMS_NOT_FOUND_ON_FLOOR", "No rooms registered on floor %d".formatted(floor));
        }

        List<FridgeCompartment> compartments = fridgeCompartmentRepository.findByFloorWithAccesses(floor).stream()
                .filter(compartment -> compartment.getFridgeUnit().getStatus().isActive())
                .sorted(Comparator.comparingInt(FridgeCompartment::getSlotIndex))
                .toList();

        if (compartments.isEmpty()) {
            throw problem(NOT_FOUND, "COMPARTMENTS_NOT_FOUND_ON_FLOOR", "No active fridge compartments found on floor %d".formatted(floor));
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
            throw problem(NOT_FOUND, "ROOMS_NOT_FOUND_ON_FLOOR", "No rooms registered on floor %d".formatted(floor));
        }
        Map<UUID, Room> roomMap = rooms.stream().collect(Collectors.toMap(Room::getId, room -> room));

        List<UUID> requestedCompartmentIds = request.allocations().stream()
                .map(CompartmentAllocationInput::compartmentId)
                .toList();
        if (requestedCompartmentIds.isEmpty()) {
            throw problem(BAD_REQUEST, "ALLOCATIONS_REQUIRED", "At least one compartment allocation must be provided");
        }

        List<FridgeCompartment> compartments = fridgeCompartmentRepository.findByIdInForUpdate(requestedCompartmentIds);
        if (compartments.size() != requestedCompartmentIds.size()) {
            throw problem(NOT_FOUND, "COMPARTMENT_NOT_FOUND", "One or more compartments do not exist on floor %d".formatted(floor));
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
                throw problem(BAD_REQUEST, "COMPARTMENT_NOT_ON_FLOOR", "Compartment %s is not on floor %d".formatted(compartment.getId(), floor));
            }
            if (!unit.getStatus().isActive()) {
                throw problem(CONFLICT, "COMPARTMENT_UNIT_INACTIVE", "Fridge unit is inactive for compartment %s".formatted(compartment.getId()));
            }
        }

        Set<UUID> floorRoomIds = new HashSet<>(roomMap.keySet());

        Map<UUID, List<UUID>> requestedAssignments = new HashMap<>();
        for (CompartmentAllocationInput input : request.allocations()) {
            FridgeCompartment compartment = Optional.ofNullable(compartmentLookup.get(input.compartmentId()))
                    .orElseThrow(() -> problem(NOT_FOUND, "COMPARTMENT_NOT_FOUND", "Compartment %s not found".formatted(input.compartmentId())));
            List<UUID> roomIds = input.roomIds() == null ? List.of() : input.roomIds();
            if (compartment.getCompartmentType() == CompartmentType.CHILL) {
                validateExclusiveRooms(roomIds, floorRoomIds, compartment);
            } else {
                validateSharedRooms(roomIds, floorRoomIds, compartment);
            }
            roomIds.forEach(roomId -> {
                if (!roomMap.containsKey(roomId)) {
                    throw problem(BAD_REQUEST, "ROOM_NOT_ON_FLOOR", "Room %s is not registered on floor %d".formatted(roomId, floor));
                }
            });
            requestedAssignments.put(compartment.getId(), List.copyOf(roomIds));
        }

        ensureChillCoverage(compartments, requestedAssignments, floorRoomIds);
        ensureUniformDistribution(compartments, requestedAssignments, floorRoomIds.size());

        OffsetDateTime now = OffsetDateTime.now(clock);
        int releasedCount = 0;
        int createdCount = 0;

        for (FridgeCompartment compartment : compartments) {
            if (!compartment.getStatus().isActive()) {
                continue;
            }
            if (compartment.isLocked() || inProgressCompartmentIds.contains(compartment.getId())) {
                throw problem(CONFLICT, "COMPARTMENT_IN_USE", "Compartment %s is locked or under inspection".formatted(compartment.getId()));
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
        String slotLabel = LabelFormatter.toSlotLetter(compartment.getSlotIndex());
        if (roomIds.isEmpty()) {
            throw problem(BAD_REQUEST, "EXCLUSIVE_COMPARTMENT_REQUIRES_ROOMS", "Slot %s requires at least one room assignment".formatted(slotLabel));
        }
        Set<UUID> duplicates = findDuplicates(roomIds);
        if (!duplicates.isEmpty()) {
            throw problem(BAD_REQUEST, "DUPLICATE_ROOM_ASSIGNMENT", "Duplicate room assignment detected for slot %s".formatted(slotLabel));
        }
        for (UUID roomId : roomIds) {
            if (!floorRoomIds.contains(roomId)) {
                throw problem(BAD_REQUEST, "ROOM_NOT_ON_FLOOR", "Room %s is not on the selected floor".formatted(roomId));
            }
        }
    }

    private void validateSharedRooms(List<UUID> roomIds, Set<UUID> floorRoomIds, FridgeCompartment compartment) {
        if (roomIds.isEmpty()) {
            throw problem(BAD_REQUEST, "SHARED_COMPARTMENT_REQUIRES_ROOMS", "Shared freezer slots must include the full floor coverage");
        }
        Set<UUID> unique = new HashSet<>(roomIds);
        if (!unique.equals(floorRoomIds)) {
            throw problem(BAD_REQUEST, "SHARED_COMPARTMENT_MUST_INCLUDE_ALL_ROOMS", "Shared freezer must include every room on the floor");
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
                throw problem(BAD_REQUEST, "CHILL_COMPARTMENT_MISSING_ASSIGNMENTS", "Chill compartment %s missing assignments".formatted(compartment.getId()));
            }
            for (UUID roomId : rooms) {
                if (!coverage.add(roomId)) {
                    throw problem(BAD_REQUEST, "ROOM_ASSIGNED_MULTIPLE_COMPARTMENTS", "Room %s assigned to multiple chill compartments".formatted(roomId));
                }
            }
        }
        if (!coverage.equals(floorRoomIds)) {
            throw problem(BAD_REQUEST, "ROOM_COVERAGE_MISMATCH", "Chill compartment assignment coverage mismatch for floor");
        }
    }

    private void ensureUniformDistribution(
            List<FridgeCompartment> compartments,
            Map<UUID, List<UUID>> requestedAssignments,
            int totalRooms
    ) {
        List<FridgeCompartment> activeChill = compartments.stream()
                .filter(compartment -> compartment.getCompartmentType() == CompartmentType.CHILL)
                .filter(compartment -> compartment.getStatus().isActive())
                .sorted(Comparator.comparingInt(FridgeCompartment::getSlotIndex))
                .toList();

        if (activeChill.isEmpty()) {
            throw problem(BAD_REQUEST, "CHILL_COMPARTMENT_INACTIVE", "No active chill compartments available for distribution");
        }
        if (totalRooms == 0) {
            throw problem(BAD_REQUEST, "ROOMS_NOT_FOUND_ON_FLOOR", "No rooms registered on the selected floor");
        }

        int baseQuota = totalRooms / activeChill.size();
        int remainder = totalRooms % activeChill.size();

        for (int i = 0; i < activeChill.size(); i++) {
            FridgeCompartment compartment = activeChill.get(i);
            int expected = baseQuota + (i < remainder ? 1 : 0);
            int actual = requestedAssignments.getOrDefault(compartment.getId(), List.of()).size();
            if (actual != expected) {
                String slotLabel = LabelFormatter.toSlotLetter(compartment.getSlotIndex());
                String detail = "Slot %s must receive %d rooms but received %d".formatted(slotLabel, expected, actual);
                throw problem(BAD_REQUEST, "ROOM_DISTRIBUTION_IMBALANCED", detail);
            }
        }
    }

    private Set<UUID> findDuplicates(List<UUID> values) {
        Set<UUID> seen = new HashSet<>();
        return values.stream()
                .filter(value -> !seen.add(value))
                .collect(Collectors.toSet());
    }

    private ProblemException problem(HttpStatus status, String code, String detail) {
        return new ProblemException(status, code, detail);
    }

    private ProblemException problem(HttpStatus status, String code) {
        return problem(status, code, null);
    }
}

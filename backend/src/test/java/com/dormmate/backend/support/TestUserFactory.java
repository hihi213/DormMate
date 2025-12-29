package com.dormmate.backend.support;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Optional;

import com.dormmate.backend.modules.auth.domain.DormUser;
import com.dormmate.backend.modules.auth.domain.DormUserStatus;
import com.dormmate.backend.modules.auth.domain.Role;
import com.dormmate.backend.modules.auth.domain.Room;
import com.dormmate.backend.modules.auth.domain.RoomAssignment;
import com.dormmate.backend.modules.auth.domain.RoomType;
import com.dormmate.backend.modules.auth.domain.UserRole;
import com.dormmate.backend.modules.auth.infrastructure.persistence.DormUserRepository;
import com.dormmate.backend.modules.auth.infrastructure.persistence.RoleRepository;
import com.dormmate.backend.modules.auth.infrastructure.persistence.RoomAssignmentRepository;
import com.dormmate.backend.modules.auth.infrastructure.persistence.RoomRepository;
import com.dormmate.backend.modules.auth.infrastructure.persistence.UserRoleRepository;

import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@Transactional
public class TestUserFactory {

    private final DormUserRepository dormUserRepository;
    private final RoleRepository roleRepository;
    private final UserRoleRepository userRoleRepository;
    private final RoomRepository roomRepository;
    private final RoomAssignmentRepository roomAssignmentRepository;
    private final PasswordEncoder passwordEncoder;

    public TestUserFactory(
            DormUserRepository dormUserRepository,
            RoleRepository roleRepository,
            UserRoleRepository userRoleRepository,
            RoomRepository roomRepository,
            RoomAssignmentRepository roomAssignmentRepository,
            PasswordEncoder passwordEncoder
    ) {
        this.dormUserRepository = dormUserRepository;
        this.roleRepository = roleRepository;
        this.userRoleRepository = userRoleRepository;
        this.roomRepository = roomRepository;
        this.roomAssignmentRepository = roomAssignmentRepository;
        this.passwordEncoder = passwordEncoder;
    }

    public DormUser ensureAdmin(String loginId, String rawPassword) {
        DormUser admin = ensureUser(loginId, rawPassword, "Admin User", loginId + "@example.com");
        ensureRole("ADMIN", "관리자");
        grantRole(admin, "ADMIN");
        return admin;
    }

    public DormUser ensureResident(
            String loginId,
            String rawPassword,
            short floor,
            String roomNumber,
            short personalNo
    ) {
        DormUser resident = ensureUser(loginId, rawPassword, "Resident " + loginId, loginId + "@example.com");
        ensureRoomAssignment(resident, floor, roomNumber, personalNo);
        return resident;
    }

    public DormUser ensureUser(String loginId, String rawPassword, String fullName, String email) {
        DormUser user = dormUserRepository.findByLoginIdIgnoreCase(loginId)
                .orElseGet(DormUser::new);
        user.setLoginId(loginId);
        user.setPasswordHash(passwordEncoder.encode(rawPassword));
        user.setFullName(fullName);
        user.setEmail(email);
        user.setStatus(DormUserStatus.ACTIVE);
        return dormUserRepository.save(user);
    }

    public void ensureRole(String code, String name) {
        roleRepository.findById(code).orElseGet(() -> {
            Role role = new Role();
            role.setCode(code);
            role.setName(name);
            role.setDescription(name + " 권한");
            return roleRepository.save(role);
        });
    }

    public void grantRole(DormUser user, String roleCode) {
        boolean alreadyActive = userRoleRepository.findActiveRoles(user.getId()).stream()
                .anyMatch(role -> roleCode.equalsIgnoreCase(role.getRole().getCode()));
        if (alreadyActive) {
            return;
        }
        Role role = roleRepository.findById(roleCode)
                .orElseThrow(() -> new IllegalStateException("Role not found: " + roleCode));
        UserRole userRole = new UserRole();
        userRole.setDormUser(user);
        userRole.setRole(role);
        userRole.setGrantedAt(OffsetDateTime.now(ZoneOffset.UTC));
        userRoleRepository.save(userRole);
    }

    public void ensureRoomAssignment(DormUser user, short floor, String roomNumber, short personalNo) {
        Optional<RoomAssignment> active = roomAssignmentRepository.findActiveAssignment(user.getId());
        if (active.isPresent()) {
            return;
        }
        Room room = findOrCreateRoom(floor, roomNumber);
        RoomAssignment assignment = new RoomAssignment();
        assignment.setDormUser(user);
        assignment.setRoom(room);
        assignment.setPersonalNo(personalNo);
        assignment.setAssignedAt(OffsetDateTime.now(ZoneOffset.UTC));
        roomAssignmentRepository.save(assignment);
    }

    private Room findOrCreateRoom(short floor, String roomNumber) {
        return roomRepository.findByFloorOrderByRoomNumber(floor).stream()
                .filter(room -> roomNumber.equals(room.getRoomNumber()))
                .findFirst()
                .orElseGet(() -> {
                    Room room = new Room();
                    room.setFloor(floor);
                    room.setRoomNumber(roomNumber);
                    room.setRoomType(RoomType.TRIPLE);
                    room.setCapacity((short) 3);
                    return roomRepository.save(room);
                });
    }
}

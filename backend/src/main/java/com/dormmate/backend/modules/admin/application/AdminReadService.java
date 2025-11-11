package com.dormmate.backend.modules.admin.application;

import java.time.Clock;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.dormmate.backend.modules.admin.domain.AdminPolicy;
import com.dormmate.backend.modules.admin.infrastructure.AdminPolicyRepository;
import com.dormmate.backend.modules.admin.presentation.dto.AdminDashboardResponse;
import com.dormmate.backend.modules.admin.presentation.dto.AdminFridgeOwnershipIssuesResponse;
import com.dormmate.backend.modules.admin.presentation.dto.AdminPoliciesResponse;
import com.dormmate.backend.modules.admin.presentation.dto.AdminUsersResponse;
import com.dormmate.backend.modules.admin.presentation.dto.AdminUserStatusFilter;
import com.dormmate.backend.modules.auth.domain.DormUser;
import com.dormmate.backend.modules.auth.domain.DormUserStatus;
import com.dormmate.backend.modules.auth.domain.UserRole;
import com.dormmate.backend.modules.auth.domain.Role;
import com.dormmate.backend.modules.auth.domain.Room;
import com.dormmate.backend.modules.auth.domain.RoomAssignment;
import com.dormmate.backend.modules.auth.domain.UserSession;
import com.dormmate.backend.modules.auth.infrastructure.persistence.DormUserRepository;
import com.dormmate.backend.modules.auth.infrastructure.persistence.RoomAssignmentRepository;
import com.dormmate.backend.modules.auth.infrastructure.persistence.UserSessionRepository;
import com.dormmate.backend.modules.fridge.domain.FridgeBundleOwnershipIssueView;
import com.dormmate.backend.modules.fridge.domain.FridgeBundleStatus;
import com.dormmate.backend.modules.fridge.domain.FridgeItemStatus;
import com.dormmate.backend.modules.fridge.infrastructure.persistence.FridgeBundleRepository;
import com.dormmate.backend.modules.fridge.infrastructure.persistence.FridgeBundleOwnershipIssueViewRepository;
import com.dormmate.backend.modules.fridge.infrastructure.persistence.FridgeItemRepository;
import com.dormmate.backend.modules.inspection.domain.InspectionSchedule;
import com.dormmate.backend.modules.inspection.domain.InspectionScheduleStatus;
import com.dormmate.backend.modules.inspection.infrastructure.persistence.InspectionScheduleRepository;
import com.dormmate.backend.modules.notification.domain.NotificationDispatchStatus;
import com.dormmate.backend.modules.notification.infrastructure.persistence.NotificationDispatchLogRepository;
import com.dormmate.backend.modules.penalty.infrastructure.persistence.PenaltyHistoryRepository;

@Service
@Transactional(readOnly = true)
public class AdminReadService {

    private static final DateTimeFormatter TIME_FORMATTER = DateTimeFormatter.ofPattern("HH:mm");
    private static final DateTimeFormatter DATE_TIME_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");
    private static final UUID POLICY_ID = UUID.fromString("00000000-0000-0000-0000-000000000001");

    private final FridgeBundleRepository fridgeBundleRepository;
    private final FridgeBundleOwnershipIssueViewRepository fridgeBundleOwnershipIssueViewRepository;
    private final FridgeItemRepository fridgeItemRepository;
    private final InspectionScheduleRepository inspectionScheduleRepository;
    private final NotificationDispatchLogRepository notificationDispatchLogRepository;
    private final DormUserRepository dormUserRepository;
    private final RoomAssignmentRepository roomAssignmentRepository;
    private final UserSessionRepository userSessionRepository;
    private final PenaltyHistoryRepository penaltyHistoryRepository;
    private final AdminPolicyRepository adminPolicyRepository;
    private final Clock clock;

    public AdminReadService(
            FridgeBundleRepository fridgeBundleRepository,
            FridgeBundleOwnershipIssueViewRepository fridgeBundleOwnershipIssueViewRepository,
            FridgeItemRepository fridgeItemRepository,
            InspectionScheduleRepository inspectionScheduleRepository,
            NotificationDispatchLogRepository notificationDispatchLogRepository,
            DormUserRepository dormUserRepository,
            RoomAssignmentRepository roomAssignmentRepository,
            UserSessionRepository userSessionRepository,
            PenaltyHistoryRepository penaltyHistoryRepository,
            AdminPolicyRepository adminPolicyRepository,
            Clock clock
    ) {
        this.fridgeBundleRepository = fridgeBundleRepository;
        this.fridgeBundleOwnershipIssueViewRepository = fridgeBundleOwnershipIssueViewRepository;
        this.fridgeItemRepository = fridgeItemRepository;
        this.inspectionScheduleRepository = inspectionScheduleRepository;
        this.notificationDispatchLogRepository = notificationDispatchLogRepository;
        this.dormUserRepository = dormUserRepository;
        this.roomAssignmentRepository = roomAssignmentRepository;
        this.userSessionRepository = userSessionRepository;
        this.penaltyHistoryRepository = penaltyHistoryRepository;
        this.adminPolicyRepository = adminPolicyRepository;
        this.clock = clock;
    }

    public AdminDashboardResponse getDashboard() {
        LocalDate today = LocalDate.now(clock);
        OffsetDateTime now = OffsetDateTime.now(clock);
        OffsetDateTime windowStart = now.minusDays(7);
        OffsetDateTime windowEnd = now.plusDays(7);

        long activeBundles = fridgeBundleRepository.countByStatus(FridgeBundleStatus.ACTIVE);
        long expiringSoon = fridgeItemRepository.countByStatusAndExpiryDateBetween(
                FridgeItemStatus.ACTIVE,
                today,
                today.plusDays(3)
        );
        long notificationFailures = notificationDispatchLogRepository.countByStatus(NotificationDispatchStatus.FAILED);

        List<InspectionSchedule> recentSchedules = inspectionScheduleRepository.findByScheduledAtBetween(windowStart, windowEnd);
        long totalSchedules = recentSchedules.size();
        long completedSchedules = recentSchedules.stream()
                .filter(schedule -> schedule.getStatus() == InspectionScheduleStatus.COMPLETED)
                .count();
        int progressRatio = totalSchedules == 0
                ? 0
                : (int) Math.round((completedSchedules * 100.0) / totalSchedules);

        List<AdminDashboardResponse.SummaryCard> summary = List.of(
                new AdminDashboardResponse.SummaryCard(
                        "inventory",
                        "층별 물품",
                        activeBundles + "건",
                        "활성 포장 수"
                ),
                new AdminDashboardResponse.SummaryCard(
                        "expiry",
                        "임박·만료",
                        expiringSoon + "건",
                        "3일 내 만료 예정"
                ),
                new AdminDashboardResponse.SummaryCard(
                        "inspection",
                        "검사 진행률",
                        progressRatio + "%",
                        "최근 일정 기준"
                ),
                new AdminDashboardResponse.SummaryCard(
                        "notification",
                        "알림 실패",
                        notificationFailures + "건",
                        "재시도 대기"
                )
        );

        List<AdminDashboardResponse.TimelineEvent> timeline = inspectionScheduleRepository.findTop5ByOrderByCreatedAtDesc()
                .stream()
                .map(schedule -> new AdminDashboardResponse.TimelineEvent(
                        schedule.getId().toString(),
                        formatTime(schedule.getScheduledAt()),
                        buildTimelineTitle(schedule),
                        buildTimelineDetail(schedule)
                ))
                .toList();

        List<AdminDashboardResponse.QuickAction> quickActions = List.of(
                new AdminDashboardResponse.QuickAction(
                        "compartment",
                        "냉장고 칸 운영",
                        "냉장고 관제실에서 허용량·잠금을 조정",
                        "/admin/fridge",
                        "clipboard"
                ),
                new AdminDashboardResponse.QuickAction(
                        "promote",
                        "층별장 임명",
                        "권한·계정 화면에서 승격/복귀 처리",
                        "/admin/users",
                        "shield"
                ),
                new AdminDashboardResponse.QuickAction(
                        "policy",
                        "알림 정책 편집",
                        "09:00 배치, 상한, dedupe 키 즉시 변경",
                        "/admin/notifications",
                        "bell"
                ),
                new AdminDashboardResponse.QuickAction(
                        "report",
                        "보고서 내려받기",
                        "검사·알림·벌점 통합 리포트 생성",
                        "/admin/audit",
                        "file"
                )
        );

        return new AdminDashboardResponse(summary, timeline, quickActions);
    }

    public AdminUsersResponse getUsers(AdminUsersQuery query) {
        DormUserStatus status = query.statusFilter().toDormUserStatus();
        List<DormUser> rawUsers = dormUserRepository.findUsersWithAssociations(status);
        Map<UUID, DormUser> uniqueUsers = new LinkedHashMap<>();
        for (DormUser user : rawUsers) {
            uniqueUsers.putIfAbsent(user.getId(), user);
        }

        OffsetDateTime now = OffsetDateTime.now(clock);
        Set<UUID> userIds = uniqueUsers.keySet();
        Map<UUID, Integer> penaltyTotals = loadPenaltyTotals(userIds, now);
        Map<UUID, RoomAssignment> activeAssignments = roomAssignmentRepository.findActiveAssignmentsByUserIds(userIds).stream()
                .collect(Collectors.toMap(
                        assignment -> assignment.getDormUser().getId(),
                        assignment -> assignment,
                        (existing, replacement) -> existing
                ));
        Map<UUID, List<UserSession>> activeSessions = userSessionRepository.findActiveSessionsByUserIds(userIds, now).stream()
                .collect(Collectors.groupingBy(session -> session.getDormUser().getId()));

        List<UUID> orderedUserIds = uniqueUsers.values().stream()
                .filter(user -> !hasActiveRole(user, "ADMIN"))
                .filter(user -> matchesFloorFilter(user, query.floor(), activeAssignments))
                .filter(user -> !query.floorManagerOnly() || hasActiveRole(user, "FLOOR_MANAGER"))
                .filter(user -> matchesSearchFilter(user, activeAssignments.get(user.getId()), query.search()))
                .sorted((a, b) -> a.getFullName().compareToIgnoreCase(b.getFullName()))
                .map(DormUser::getId)
                .toList();

        int normalizedSize = normalizeSize(query.size());
        int normalizedPage = normalizePage(query.page());
        int totalElements = orderedUserIds.size();
        int totalPages = (int) Math.ceil(totalElements / (double) normalizedSize);

        int fromIndex = Math.min(normalizedPage * normalizedSize, totalElements);
        int toIndex = Math.min(fromIndex + normalizedSize, totalElements);

        List<AdminUsersResponse.User> users = orderedUserIds.subList(fromIndex, toIndex).stream()
                .map(uniqueUsers::get)
                .map(user -> mapUser(
                        user,
                        now,
                        activeAssignments.get(user.getId()),
                        activeSessions.getOrDefault(user.getId(), List.of()),
                        penaltyTotals
                ))
                .toList();

        List<Integer> availableFloors = resolveAvailableFloors(activeAssignments);

        return new AdminUsersResponse(
                users,
                normalizedPage,
                normalizedSize,
                totalElements,
                totalPages,
                availableFloors
        );
    }

    public AdminPoliciesResponse getPolicies() {
        AdminPolicy policy = adminPolicyRepository.findById(POLICY_ID).orElse(null);

        String batchTime = policy != null ? policy.getNotificationBatchTime().format(TIME_FORMATTER) : "09:00";
        int dailyLimit = policy != null ? policy.getNotificationDailyLimit() : 20;
        int ttlHours = policy != null ? policy.getNotificationTtlHours() : 24;
        int penaltyLimit = policy != null ? policy.getPenaltyLimit() : 10;
        String penaltyTemplate = policy != null
                ? policy.getPenaltyTemplate()
                : "DormMate 벌점 누적 {점수}점으로 세탁실/다목적실/도서관 이용이 7일간 제한됩니다. 냉장고 기능은 유지됩니다.";

        AdminPoliciesResponse.NotificationPolicy notificationPolicy = new AdminPoliciesResponse.NotificationPolicy(
                batchTime,
                dailyLimit,
                ttlHours
        );
        AdminPoliciesResponse.PenaltyPolicy penaltyPolicy = new AdminPoliciesResponse.PenaltyPolicy(
                penaltyLimit,
                penaltyTemplate
        );
        return new AdminPoliciesResponse(notificationPolicy, penaltyPolicy);
    }

    private AdminUsersResponse.User mapUser(
            DormUser user,
            OffsetDateTime now,
            RoomAssignment activeAssignment,
            List<UserSession> sessions,
            Map<UUID, Integer> penaltyTotals
    ) {
        List<String> activeRoles = user.getRoles().stream()
                .filter(role -> role.getRevokedAt() == null)
                .map(UserRole::getRole)
                .map(role -> role.getCode().toUpperCase(Locale.ROOT))
                .distinct()
                .toList();

        String primaryRole = determinePrimaryRole(activeRoles);

        String roomDisplay = Optional.ofNullable(activeAssignment)
                .map(assignment -> assignment.getRoom().getDisplayName())
                .orElse("호실 미배정");
        Integer floor = Optional.ofNullable(activeAssignment)
                .map(assignment -> (int) assignment.getRoom().getFloor())
                .orElse(null);
        String roomCode = Optional.ofNullable(activeAssignment)
                .map(assignment -> assignment.getRoom().getFloor() + assignment.getRoom().getRoomNumber())
                .orElse(null);
        Short personalNo = Optional.ofNullable(activeAssignment)
                .map(RoomAssignment::getPersonalNo)
                .orElse(null);

        String lastLogin = sessions.stream()
                .filter(session -> session.getIssuedAt() != null)
                .map(session -> session.getIssuedAt().atZoneSameInstant(clock.getZone()).toOffsetDateTime())
                .max(OffsetDateTime::compareTo)
                .map(dateTime -> dateTime.format(DATE_TIME_FORMATTER))
                .orElse("-");

        int penaltyPoints = penaltyTotals.getOrDefault(user.getId(), 0);

        return new AdminUsersResponse.User(
                user.getId().toString(),
                user.getFullName(),
                roomDisplay,
                floor,
                roomCode,
                personalNo,
                primaryRole,
                activeRoles,
                user.getStatus().name(),
                lastLogin,
                penaltyPoints
        );
    }

    private Map<UUID, Integer> loadPenaltyTotals(Set<UUID> userIds, OffsetDateTime now) {
        if (userIds.isEmpty()) {
            return Map.of();
        }
        return penaltyHistoryRepository.sumPenaltiesByUserIds(userIds, now).stream()
                .collect(Collectors.toMap(
                        PenaltyHistoryRepository.PenaltyTotal::getUserId,
                        total -> total.getTotalPoints() != null ? total.getTotalPoints().intValue() : 0
                ));
    }

    private String determinePrimaryRole(List<String> roles) {
        if (roles.contains("ADMIN")) {
            return "ADMIN";
        }
        if (roles.contains("FLOOR_MANAGER")) {
            return "FLOOR_MANAGER";
        }
        if (roles.contains("RESIDENT")) {
            return "RESIDENT";
        }
        return roles.isEmpty() ? "RESIDENT" : roles.getFirst();
    }

    public AdminFridgeOwnershipIssuesResponse getFridgeOwnershipIssues(int page, int size, UUID ownerUserId) {
        int normalizedPage = Math.max(page, 0);
        int normalizedSize = Math.min(Math.max(size, 1), 100);
        PageRequest pageable = PageRequest.of(
                normalizedPage,
                normalizedSize,
                Sort.by(Sort.Direction.DESC, "updatedAt")
        );
        Page<FridgeBundleOwnershipIssueView> result;
        if (ownerUserId != null) {
            result = fridgeBundleOwnershipIssueViewRepository.findByOwnerUserId(ownerUserId, pageable);
        } else {
            result = fridgeBundleOwnershipIssueViewRepository.findAll(pageable);
        }
        List<AdminFridgeOwnershipIssuesResponse.Issue> items = result.getContent().stream()
                .map(this::mapOwnershipIssue)
                .toList();

        return new AdminFridgeOwnershipIssuesResponse(
                items,
                result.getNumber(),
                result.getSize(),
                result.getTotalElements(),
                result.getTotalPages()
        );
    }

    private AdminFridgeOwnershipIssuesResponse.Issue mapOwnershipIssue(FridgeBundleOwnershipIssueView view) {
        return new AdminFridgeOwnershipIssuesResponse.Issue(
                view.getBundleId(),
                view.getBundleName(),
                view.getLabelNumber(),
                view.getOwnerUserId(),
                view.getOwnerName(),
                view.getOwnerLoginId(),
                view.getRoomId(),
                view.getRoomNumber(),
                view.getRoomFloor(),
                view.getPersonalNo(),
                view.getFridgeCompartmentId(),
                view.getSlotIndex(),
                view.getCompartmentType() != null ? view.getCompartmentType().name() : null,
                view.getFridgeFloorNo(),
                view.getFridgeDisplayName(),
                view.getIssueType(),
                view.getCreatedAt(),
                view.getUpdatedAt()
        );
    }

    private boolean hasActiveRole(DormUser user, String roleCode) {
        if (roleCode == null || roleCode.isBlank()) {
            return false;
        }
        String normalized = roleCode.trim().toUpperCase(Locale.ROOT);
        return user.getRoles().stream()
                .filter(role -> role.getRevokedAt() == null)
                .map(UserRole::getRole)
                .filter(Objects::nonNull)
                .map(Role::getCode)
                .filter(Objects::nonNull)
                .map(code -> code.toUpperCase(Locale.ROOT))
                .anyMatch(normalized::equals);
    }

    private String buildTimelineTitle(InspectionSchedule schedule) {
        if (schedule.getTitle() != null && !schedule.getTitle().isBlank()) {
            return schedule.getTitle();
        }
        return switch (schedule.getStatus()) {
            case COMPLETED -> "검사 완료";
            case CANCELLED -> "검사 취소";
            default -> "검사 일정";
        };
    }

    private String buildTimelineDetail(InspectionSchedule schedule) {
        return switch (schedule.getStatus()) {
            case COMPLETED -> "완료 시각: " + formatDateTime(schedule.getCompletedAt());
            case CANCELLED -> "취소됨";
            default -> "예정 시각: " + formatDateTime(schedule.getScheduledAt());
        };
    }

    private String formatTime(OffsetDateTime dateTime) {
        if (dateTime == null) {
            return "--:--";
        }
        return dateTime.atZoneSameInstant(clock.getZone()).toLocalTime().format(TIME_FORMATTER);
    }

    private String formatDateTime(OffsetDateTime dateTime) {
        if (dateTime == null) {
            return "-";
        }
        return dateTime.atZoneSameInstant(clock.getZone()).format(DATE_TIME_FORMATTER);
    }

    private boolean matchesFloorFilter(DormUser user, Integer floor, Map<UUID, RoomAssignment> assignments) {
        if (floor == null) {
            return true;
        }
        RoomAssignment assignment = assignments.get(user.getId());
        if (assignment == null || assignment.getRoom() == null) {
            return false;
        }
        return assignment.getRoom().getFloor() == floor;
    }

    private boolean matchesSearchFilter(DormUser user, RoomAssignment assignment, String rawSearch) {
        if (rawSearch == null || rawSearch.isBlank()) {
            return true;
        }
        String search = rawSearch.trim().toLowerCase(Locale.ROOT);
        if (user.getFullName() != null && user.getFullName().toLowerCase(Locale.ROOT).contains(search)) {
            return true;
        }
        if (user.getLoginId() != null && user.getLoginId().toLowerCase(Locale.ROOT).contains(search)) {
            return true;
        }
        if (assignment == null || assignment.getRoom() == null) {
            return false;
        }
        Room room = assignment.getRoom();
        String roomNumberRaw = room.getRoomNumber() != null ? room.getRoomNumber() : "";
        String roomNumber = roomNumberRaw.toLowerCase(Locale.ROOT);
        String floorText = String.valueOf(room.getFloor());
        String roomCode = (floorText + roomNumberRaw).toLowerCase(Locale.ROOT);
        String roomDisplay = (floorText + "f " + roomNumberRaw).toLowerCase(Locale.ROOT);
        String roomOnly = roomNumber;
        String roomWithPersonal = roomCode + "-" + assignment.getPersonalNo();

        return roomCode.contains(search)
                || roomDisplay.contains(search)
                || roomOnly.contains(search)
                || floorText.contains(search)
                || roomWithPersonal.contains(search);
    }

    private int normalizePage(int page) {
        return Math.max(page, 0);
    }

    private int normalizeSize(int size) {
        int normalized = Math.max(size, 1);
        return Math.min(normalized, 100);
    }

    private List<Integer> resolveAvailableFloors(Map<UUID, RoomAssignment> assignments) {
        return assignments.values().stream()
                .map(RoomAssignment::getRoom)
                .filter(Objects::nonNull)
                .map(room -> (int) room.getFloor())
                .distinct()
                .sorted()
                .toList();
    }

    public record AdminUsersQuery(
            AdminUserStatusFilter statusFilter,
            Integer floor,
            boolean floorManagerOnly,
            String search,
            int page,
            int size
    ) {
    }
}

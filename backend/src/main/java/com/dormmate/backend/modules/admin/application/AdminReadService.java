package com.dormmate.backend.modules.admin.application;

import java.time.Clock;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.dormmate.backend.modules.admin.presentation.dto.AdminDashboardResponse;
import com.dormmate.backend.modules.admin.presentation.dto.AdminPoliciesResponse;
import com.dormmate.backend.modules.admin.presentation.dto.AdminResourceResponse;
import com.dormmate.backend.modules.admin.presentation.dto.AdminUsersResponse;
import com.dormmate.backend.modules.auth.domain.DormUser;
import com.dormmate.backend.modules.auth.domain.DormUserStatus;
import com.dormmate.backend.modules.auth.domain.RoomAssignment;
import com.dormmate.backend.modules.auth.domain.UserRole;
import com.dormmate.backend.modules.auth.infrastructure.persistence.DormUserRepository;
import com.dormmate.backend.modules.fridge.domain.CompartmentRoomAccess;
import com.dormmate.backend.modules.fridge.domain.FridgeBundleStatus;
import com.dormmate.backend.modules.fridge.domain.FridgeCompartment;
import com.dormmate.backend.modules.fridge.domain.FridgeItemStatus;
import com.dormmate.backend.modules.fridge.infrastructure.persistence.CompartmentRoomAccessRepository;
import com.dormmate.backend.modules.fridge.infrastructure.persistence.FridgeBundleRepository;
import com.dormmate.backend.modules.fridge.infrastructure.persistence.FridgeCompartmentRepository;
import com.dormmate.backend.modules.fridge.infrastructure.persistence.FridgeItemRepository;
import com.dormmate.backend.modules.inspection.domain.InspectionSchedule;
import com.dormmate.backend.modules.inspection.domain.InspectionScheduleStatus;
import com.dormmate.backend.modules.inspection.infrastructure.persistence.InspectionScheduleRepository;
import com.dormmate.backend.modules.notification.domain.NotificationDispatchStatus;
import com.dormmate.backend.modules.notification.infrastructure.persistence.NotificationDispatchLogRepository;

@Service
@Transactional(readOnly = true)
public class AdminReadService {

    private static final DateTimeFormatter TIME_FORMATTER = DateTimeFormatter.ofPattern("HH:mm");
    private static final DateTimeFormatter DATE_TIME_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");

    private final FridgeBundleRepository fridgeBundleRepository;
    private final FridgeItemRepository fridgeItemRepository;
    private final InspectionScheduleRepository inspectionScheduleRepository;
    private final NotificationDispatchLogRepository notificationDispatchLogRepository;
    private final FridgeCompartmentRepository fridgeCompartmentRepository;
    private final CompartmentRoomAccessRepository compartmentRoomAccessRepository;
    private final DormUserRepository dormUserRepository;
    private final Clock clock;

    public AdminReadService(
            FridgeBundleRepository fridgeBundleRepository,
            FridgeItemRepository fridgeItemRepository,
            InspectionScheduleRepository inspectionScheduleRepository,
            NotificationDispatchLogRepository notificationDispatchLogRepository,
            FridgeCompartmentRepository fridgeCompartmentRepository,
            CompartmentRoomAccessRepository compartmentRoomAccessRepository,
            DormUserRepository dormUserRepository,
            Clock clock
    ) {
        this.fridgeBundleRepository = fridgeBundleRepository;
        this.fridgeItemRepository = fridgeItemRepository;
        this.inspectionScheduleRepository = inspectionScheduleRepository;
        this.notificationDispatchLogRepository = notificationDispatchLogRepository;
        this.fridgeCompartmentRepository = fridgeCompartmentRepository;
        this.compartmentRoomAccessRepository = compartmentRoomAccessRepository;
        this.dormUserRepository = dormUserRepository;
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
                        "칸 상태 전환",
                        "자원 관리 허브에서 SUSPENDED/ACTIVE 전환",
                        "/admin/manage/resources",
                        "clipboard"
                ),
                new AdminDashboardResponse.QuickAction(
                        "promote",
                        "층별장 임명",
                        "권한·계정 화면에서 승격/복귀 처리",
                        "/admin/manage/roles",
                        "shield"
                ),
                new AdminDashboardResponse.QuickAction(
                        "policy",
                        "알림 정책 편집",
                        "09:00 배치, 상한, dedupe 키 즉시 변경",
                        "/admin/manage/policies",
                        "bell"
                ),
                new AdminDashboardResponse.QuickAction(
                        "report",
                        "보고서 내려받기",
                        "검사·알림·벌점 통합 리포트 생성",
                        "/admin/manage/reports",
                        "file"
                )
        );

        return new AdminDashboardResponse(summary, timeline, quickActions);
    }

    public AdminResourceResponse getResources() {
        List<FridgeCompartment> compartments = fridgeCompartmentRepository.findAllWithActiveUnit();
        if (compartments.isEmpty()) {
            return new AdminResourceResponse(List.of());
        }

        List<UUID> compartmentIds = compartments.stream()
                .map(FridgeCompartment::getId)
                .toList();

        Map<UUID, List<CompartmentRoomAccess>> roomAccessMap = compartmentIds.isEmpty()
                ? Map.of()
                : compartmentRoomAccessRepository
                .findActiveAccessesByCompartmentIds(compartmentIds)
                .stream()
                .collect(Collectors.groupingBy(access -> access.getFridgeCompartment().getId()));

        Map<UUID, Long> bundleCountMap = compartmentIds.isEmpty()
                ? Map.of()
                : fridgeBundleRepository.countActiveBundlesByCompartmentIds(
                        compartmentIds,
                        FridgeBundleStatus.ACTIVE
                ).stream()
                .collect(Collectors.toMap(
                        FridgeBundleRepository.ActiveBundleCountProjection::getCompartmentId,
                        FridgeBundleRepository.ActiveBundleCountProjection::getActiveCount
                ));

        List<AdminResourceResponse.Resource> resources = new ArrayList<>();
        for (FridgeCompartment compartment : compartments) {
            UUID compartmentId = compartment.getId();
            long activeBundles = bundleCountMap.getOrDefault(compartmentId, 0L);
            List<CompartmentRoomAccess> accesses = roomAccessMap.getOrDefault(compartmentId, List.of());
            String rooms = accesses.stream()
                    .map(access -> access.getRoom().getDisplayName())
                    .sorted()
                    .collect(Collectors.joining(", "));
            String location = compartment.getFridgeUnit().getDisplayName() != null
                    ? compartment.getFridgeUnit().getDisplayName()
                    : compartment.getFridgeUnit().getFloorNo() + "층 냉장고";

            resources.add(new AdminResourceResponse.Resource(
                    compartmentId.toString(),
                    "fridge",
                    location + " - 칸 " + compartment.getSlotIndex(),
                    location,
                    compartment.getStatus().name(),
                    activeBundles + "/" + compartment.getMaxBundleCount(),
                    "-",
                    rooms,
                    null,
                    compartment.getStatus().isActive() ? null : "점검 필요",
                    null
            ));
        }

        return new AdminResourceResponse(resources);
    }

    public AdminUsersResponse getUsers() {
        List<DormUser> rawUsers = dormUserRepository.findActiveUsersWithRoles(DormUserStatus.ACTIVE);
        Map<UUID, DormUser> uniqueUsers = new LinkedHashMap<>();
        for (DormUser user : rawUsers) {
            uniqueUsers.putIfAbsent(user.getId(), user);
        }

        List<AdminUsersResponse.User> users = uniqueUsers.values().stream()
                .map(this::mapUser)
                .sorted((a, b) -> a.name().compareToIgnoreCase(b.name()))
                .toList();

        return new AdminUsersResponse(users);
    }

    public AdminPoliciesResponse getPolicies() {
        AdminPoliciesResponse.NotificationPolicy notificationPolicy = new AdminPoliciesResponse.NotificationPolicy(
                "09:00",
                20,
                24
        );
        AdminPoliciesResponse.PenaltyPolicy penaltyPolicy = new AdminPoliciesResponse.PenaltyPolicy(
                10,
                "DormMate 벌점 누적 {점수}점으로 세탁실/다목적실/도서관 이용이 7일간 제한됩니다. 냉장고 기능은 유지됩니다."
        );
        return new AdminPoliciesResponse(notificationPolicy, penaltyPolicy);
    }

    private AdminUsersResponse.User mapUser(DormUser user) {
        List<String> activeRoles = user.getRoles().stream()
                .filter(role -> role.getRevokedAt() == null)
                .map(UserRole::getRole)
                .map(role -> role.getCode().toUpperCase(Locale.ROOT))
                .distinct()
                .toList();

        String primaryRole = determinePrimaryRole(activeRoles);

        String roomDisplay = user.getRoomAssignments().stream()
                .filter(RoomAssignment::isActive)
                .map(assignment -> assignment.getRoom().getDisplayName())
                .sorted()
                .collect(Collectors.joining(", "));
        if (roomDisplay.isBlank()) {
            roomDisplay = "-";
        }

        String lastLogin = user.getSessions().stream()
                .filter(session -> session.getRevokedAt() == null)
                .map(session -> session.getIssuedAt().atZoneSameInstant(clock.getZone()).toOffsetDateTime())
                .max(OffsetDateTime::compareTo)
                .map(dateTime -> dateTime.format(DATE_TIME_FORMATTER))
                .orElse("-");

        return new AdminUsersResponse.User(
                user.getId().toString(),
                user.getFullName(),
                roomDisplay,
                primaryRole,
                activeRoles,
                user.getStatus().name(),
                lastLogin,
                0,
                0
        );
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
        return roles.isEmpty() ? "RESIDENT" : roles.get(0);
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
}

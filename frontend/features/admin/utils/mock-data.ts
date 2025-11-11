import type { AdminQuickAction, AdminSummaryCard, AdminTimelineEvent, AdminUser } from "../types"

export const mockSummaryCards: AdminSummaryCard[] = [
  { id: "inventory", label: "층별 물품", value: "128건", description: "최근 7일 등록" },
  { id: "expiry", label: "임박·만료", value: "12건", description: "24시간 내 조치 필요" },
  { id: "inspection", label: "검사 진행률", value: "82%", description: "주간 목표 대비" },
  { id: "notification", label: "알림 실패", value: "1건", description: "Outbox에서 재시도" },
]

export const mockTimelineEvents: AdminTimelineEvent[] = [
  {
    id: "event-1",
    time: "09:10",
    title: "3층 검사 결과 제출",
    detail: "층별장(박층장)이 경고 1건, 폐기 0건으로 처리",
  },
  {
    id: "event-2",
    time: "09:00",
    title: "임박/만료 알림 배치 발송",
    detail: "12건 발송 / 실패 0건 — 정책 09:00 기준 정상",
  },
  {
    id: "event-3",
    time: "08:30",
    title: "냉장 B-2 칸 중단 요청",
    detail: "거주자 4명 영향 — 냉장고 관제실에서 상태 전환 필요",
  },
]

export const mockQuickActions: AdminQuickAction[] = [
  {
    id: "compartment",
    title: "냉장고 칸 운영",
    description: "냉장고 관제실에서 허용량·잠금을 조정",
    href: "/admin/fridge",
    icon: "clipboard",
  },
  {
    id: "promote",
    title: "층별장 임명",
    description: "사용자 목록에서 승격/복귀 처리",
    href: "/admin/users",
    icon: "shield",
  },
  {
    id: "policy",
    title: "알림 정책 편집",
    description: "09:00 배치, 상한, dedupe 키 즉시 변경",
    href: "/admin/notifications",
    icon: "bell",
  },
  {
    id: "report",
    title: "보고서 내려받기",
    description: "검사·알림·벌점 통합 리포트 생성",
    href: "/admin/audit",
    icon: "file",
  },
]

export const mockUsers: AdminUser[] = [
  {
    id: "user-301",
    name: "박층장",
    room: "3F 13",
    floor: 3,
    roomCode: "313",
    personalNo: 1,
    role: "FLOOR_MANAGER",
    roles: ["RESIDENT", "FLOOR_MANAGER"],
    status: "ACTIVE",
    lastLogin: "2025-11-01 08:40",
    penalties: 0,
  },
  {
    id: "user-302",
    name: "김도미",
    room: "3F 02",
    floor: 3,
    roomCode: "302",
    personalNo: 2,
    role: "RESIDENT",
    roles: ["RESIDENT"],
    status: "ACTIVE",
    lastLogin: "2025-10-31 23:18",
    penalties: 1,
  },
  {
    id: "user-admin",
    name: "관리자",
    room: "호실 미배정",
    floor: null,
    roomCode: null,
    personalNo: null,
    role: "ADMIN",
    roles: ["ADMIN"],
    status: "ACTIVE",
    lastLogin: "2025-11-01 07:55",
  },
  {
    id: "user-401",
    name: "이훈",
    room: "4F 13",
    floor: 4,
    roomCode: "413",
    personalNo: 1,
    role: "FLOOR_MANAGER",
    roles: ["RESIDENT", "FLOOR_MANAGER"],
    status: "ACTIVE",
    lastLogin: "2025-10-29 19:12",
    penalties: 2,
  },
]

export type FixtureRole = "resident" | "floorManager" | "admin"

const VALID_ROLES: FixtureRole[] = ["resident", "floorManager", "admin"]
const TOKEN_PREFIX = "fixture-token"

const ROLE_TO_PROFILE: Record<
  FixtureRole,
  {
    userId: string
    loginId: string
    displayName: string
    roles: Array<"RESIDENT" | "FLOOR_MANAGER" | "ADMIN">
    isFloorManager: boolean
    isAdmin: boolean
    primaryRoom?: {
      roomId: string
      floor: number
      roomNumber: string
      personalNo: number
      assignedAt: string
    } | null
  }
> = {
  resident: {
    userId: "fixture-resident",
    loginId: "resident01",
    displayName: "거주자 테스트",
    roles: ["RESIDENT"],
    isFloorManager: false,
    isAdmin: false,
    primaryRoom: {
      roomId: "room-201",
      floor: 2,
      roomNumber: "201",
      personalNo: 1,
      assignedAt: new Date().toISOString(),
    },
  },
  floorManager: {
    userId: "fixture-floor-manager",
    loginId: "floor01",
    displayName: "층별장 테스트",
    roles: ["FLOOR_MANAGER"],
    isFloorManager: true,
    isAdmin: false,
    primaryRoom: {
      roomId: "room-301",
      floor: 3,
      roomNumber: "301",
      personalNo: 1,
      assignedAt: new Date().toISOString(),
    },
  },
  admin: {
    userId: "fixture-admin",
    loginId: "admin",
    displayName: "관리자 테스트",
    roles: ["ADMIN"],
    isFloorManager: false,
    isAdmin: true,
    primaryRoom: null,
  },
}

const DEFAULT_ROLE: FixtureRole = "resident"

function tryParseFromAuthorization(headerValue: string | null): FixtureRole | null {
  if (!headerValue) return null
  const token = headerValue.replace(/^Bearer\s+/i, "").trim()
  if (!token.startsWith(TOKEN_PREFIX)) return null
  const match = token.match(/^fixture-token-([a-zA-Z]+)/)
  if (!match) return null
  const candidate = match[1]
  return isFixtureRole(candidate) ? candidate : null
}

function tryParseFromCookie(cookieHeader: string | null): FixtureRole | null {
  if (!cookieHeader) return null
  const match = cookieHeader.match(/dm_fixture_role=([^;]+)/)
  if (!match) return null
  const candidate = decodeURIComponent(match[1])
  return isFixtureRole(candidate) ? candidate : null
}

function tryParseFromQuery(url: string): FixtureRole | null {
  const { searchParams } = new URL(url)
  const candidate = searchParams.get("role")
  return isFixtureRole(candidate) ? candidate : null
}

export function resolveFixtureRole(request: Request): FixtureRole {
  return (
    tryParseFromAuthorization(request.headers.get("authorization")) ??
    tryParseFromCookie(request.headers.get("cookie")) ??
    tryParseFromQuery(request.url) ??
    DEFAULT_ROLE
  )
}

export function buildUserProfile(role: FixtureRole) {
  const profile = ROLE_TO_PROFILE[role]
  const timestamp = new Date().toISOString()
  return {
    userId: profile.userId,
    loginId: profile.loginId,
    displayName: profile.displayName,
    email: `${profile.loginId}@fixture.invalid`,
    roles: profile.roles,
    primaryRoom: profile.primaryRoom ?? null,
    isFloorManager: profile.isFloorManager,
    isAdmin: profile.isAdmin,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

export function ensureRole<T>(role: FixtureRole, allowed: FixtureRole[], body: T): Response {
  if (!allowed.includes(role)) {
    return Response.json(
      { message: "권한이 없습니다.", code: "FORBIDDEN" },
      { status: 403, headers: { "content-type": "application/json" } },
    )
  }
  return Response.json(body)
}

export function buildAdminDashboardFixture() {
  return {
    summary: [
      { id: "fridge", title: "냉장고 검사", value: "완료 8 / 예정 2", delta: "+1" },
      { id: "laundry", title: "세탁실 회전율", value: "68%", delta: "+5%" },
      { id: "penalty", title: "벌점 누적 경고", value: "12건", delta: "+2" },
    ],
    timeline: [
      {
        id: "inspect-locked",
        label: "검사 잠금 자동 해제",
        timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
        actor: "시스템",
        description: "3층 냉장고 A 칸 잠금이 자동으로 해제되었습니다.",
      },
      {
        id: "penalty-escalation",
        label: "벌점 승격 검토",
        timestamp: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        actor: "운영팀",
        description: "세탁실 무단 점유 관련 벌점 3건이 승격 검토 중입니다.",
      },
    ],
    quickActions: [
      {
        id: "fridge-locks",
        label: "검사 잠금 현황",
        link: "/admin/fridge?filter=locked",
        description: "잠금 유지 1건 · 자동 해제 대기 2건",
      },
      {
        id: "penalty-review",
        label: "벌점 검토",
        link: "/admin/users?panel=penalties",
        description: "승격 검토 3건 · 만료 임박 4건",
      },
    ],
  }
}

export function buildFridgeSlotList() {
  const slotId = "00000000-0000-0000-0000-00000000a001"
  return {
    items: [
      {
        slotId,
        slotIndex: 0,
        slotLetter: "A",
        floorNo: 2,
        floorCode: "2F",
        compartmentType: "CHILL",
        resourceStatus: "ACTIVE",
        locked: false,
        lockedUntil: null,
        capacity: 24,
        displayName: "2층 냉장 A",
        occupiedCount: 0,
      },
    ],
    totalCount: 1,
  }
}

export function buildInspectionSchedules() {
  const now = new Date()
  const future = new Date(now.getTime() + 60 * 60 * 1000)
  return [
    {
      scheduleId: "sched-0001",
      scheduledAt: future.toISOString(),
      title: "3층 정기 점검",
      notes: "냉장칸 A · 임박/만료 배지 확인",
      status: "SCHEDULED" as const,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      inspectionSessionId: null,
      fridgeCompartmentId: "00000000-0000-0000-0000-00000000a001",
      slotIndex: 0,
      slotLetter: "A",
      floorNo: 3,
      floorCode: "3F",
      completedAt: null,
    },
  ]
}

export function buildInspectionHistoryFixture() {
  const slotId = "00000000-0000-0000-0000-00000000a001"
  const cancelNote = "자동화 테스트용 취소 세션 메모"
  return [
    {
      sessionId: "10000000-0000-0000-0000-000000000001",
      slotId,
      slotIndex: 0,
      slotLabel: "A",
      floorNo: 2,
      floorCode: "2F",
      status: "CANCELLED",
      startedBy: "20000000-0000-0000-0000-000000000002",
      startedAt: "2024-10-01T09:00:00Z",
      endedAt: "2024-10-01T09:15:00Z",
      bundles: [],
      summary: [
        {
          action: "PASS",
          count: 1,
        },
      ],
      actions: [],
      notes: cancelNote,
      initialBundleCount: 3,
      totalBundleCount: 3,
    },
  ]
}

function isFixtureRole(candidate: string | null | undefined): candidate is FixtureRole {
  return typeof candidate === "string" && VALID_ROLES.includes(candidate as FixtureRole)
}

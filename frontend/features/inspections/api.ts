import { safeApiCall } from "@/lib/api-client"
import { mapBundleFromDto, toItems, toSlotLetter } from "@/features/fridge/utils/data-shaping"
import type { Bundle, ItemUnit, Slot } from "@/features/fridge/types"
import { mapSlotFromDto } from "@/features/fridge/utils/data-shaping"
import type { FridgeBundleDto, FridgeSlotListResponseDto } from "@/features/fridge/utils/data-shaping"
import type {
  InspectionAction,
  InspectionActionEntry,
  InspectionSchedule,
  InspectionSession,
  InspectionSubmitPayload,
} from "@/features/inspections/types"

const isFixtureEnabled = process.env.NEXT_PUBLIC_FIXTURE === "1"

const isFixtureRuntime = () =>
  typeof window !== "undefined" &&
  (window.localStorage?.getItem("dm.fixture") === "1" || (window as any).__DM_FIXTURE__ === true)

const isFixtureMode = () => isFixtureEnabled || isFixtureRuntime()

async function fetchFixture<T>(resource: "slots" | "active" | "history" | "schedules"): Promise<T | undefined> {
  const response = await fetch(`/api/__fixtures__/fridge/inspections?resource=${resource}`)
  if (response.status === 204) {
    return undefined
  }
  if (!response.ok) {
    throw new Error(`Fixture 요청 실패 (${resource})`)
  }
  return (await response.json()) as T
}

type InspectionActionSummaryDto = {
  action: InspectionAction
  count: number
}

type InspectionActionItemDto = {
  id: number
  fridgeItemId?: string | null
  snapshotName?: string | null
  snapshotExpiresOn?: string | null
  quantityAtAction?: number | null
  correlationId?: string | null
}

type PenaltyHistoryDto = {
  id: string
  points: number
  reason?: string | null
  issuedAt: string
  expiresAt?: string | null
  correlationId?: string | null
}

type InspectionActionDetailDto = {
  actionId: number
  actionType: InspectionAction
  bundleId?: string | null
  targetUserId?: string | null
  recordedAt: string
  recordedBy?: string | null
  note?: string | null
  correlationId?: string | null
  items?: InspectionActionItemDto[]
  penalties?: PenaltyHistoryDto[]
}

type InspectionSessionDto = {
  sessionId: string
  slotId: string
  slotIndex: number
  slotLabel?: string | null
  floorNo: number
  floorCode?: string | null
  status: InspectionSession["status"]
  startedBy: string
  startedAt: string
  endedAt?: string | null
  bundles: FridgeBundleDto[]
  summary: InspectionActionSummaryDto[]
  actions?: InspectionActionDetailDto[]
  notes?: string | null
  initialBundleCount?: number | null
  totalBundleCount?: number | null
}

type InspectionScheduleDto = {
  scheduleId: string
  scheduledAt: string
  title?: string | null
  notes?: string | null
  status: InspectionSchedule["status"]
  completedAt?: string | null
  inspectionSessionId?: string | null
  fridgeCompartmentId?: string | null
  slotIndex?: number | null
  slotLetter?: string | null
  floorNo?: number | null
  floorCode?: string | null
  createdAt: string
  updatedAt: string
}

type StartInspectionRequest = {
  slotId: string
  scheduleId?: string | null
}

type ActionRequestDto = {
  actions: Array<{
    bundleId?: string | null
    itemId?: string | null
    action: InspectionAction
    note?: string | null
  }>
}

export async function startInspection(payload: StartInspectionRequest): Promise<InspectionSession> {
  const body = {
    slotId: payload.slotId,
    scheduleId: payload.scheduleId ?? undefined,
  }
  const { data, error } = await safeApiCall<InspectionSessionDto>("/fridge/inspections", {
    method: "POST",
    body,
  })

  if (error || !data) {
    throw new Error(error?.message ?? "검사 세션을 시작하지 못했습니다.")
  }

  return mapInspectionSessionDto(data)
}

export async function fetchActiveInspection(floor?: number): Promise<InspectionSession | null> {
  if (isFixtureMode()) {
    const fixture = await fetchFixture<InspectionSessionDto | undefined>("active")
    if (!fixture) return null
    return mapInspectionSessionDto(fixture)
  }

  const search = new URLSearchParams()
  if (typeof floor === "number") {
    search.set("floor", String(floor))
  }
  const path = search.toString() ? `/fridge/inspections/active?${search}` : "/fridge/inspections/active"

  const result = await safeApiCall<InspectionSessionDto>(path, { method: "GET" })
  if (result.error) {
    if (result.error.status === 204) return null
    if (result.error.status === 404) return null
    if (result.error.status === 401) return null
    if (result.error.status === 403 && (result.error.code === "FORBIDDEN_SLOT" || result.error.code === "FLOOR_SCOPE_VIOLATION")) {
      return null
    }
    throw new Error(result.error.message ?? "검사 세션을 조회하지 못했습니다.")
  }

  if (!result.data) return null
  return mapInspectionSessionDto(result.data)
}

export async function fetchInspection(sessionId: string): Promise<InspectionSession> {
  const { data, error } = await safeApiCall<InspectionSessionDto>(`/fridge/inspections/${sessionId}`, {
    method: "GET",
  })
  if (error || !data) {
    throw new Error(error?.message ?? "검사 세션을 불러오지 못했습니다.")
  }
  return mapInspectionSessionDto(data)
}

export async function cancelInspection(sessionId: string): Promise<void> {
  const { error } = await safeApiCall(`/fridge/inspections/${sessionId}`, {
    method: "DELETE",
    parseResponseAs: "none",
  })
  if (error) {
    throw new Error(error.message ?? "검사 세션을 취소하지 못했습니다.")
  }
}

export async function recordInspectionActions(
  sessionId: string,
  actions: InspectionActionEntry[],
): Promise<InspectionSession> {
  if (!actions.length) {
    throw new Error("전송할 검사 조치가 없습니다.")
  }

  const payload: ActionRequestDto = {
    actions: actions.map((action) => ({
      bundleId: action.bundleId ?? null,
      itemId: action.itemId ?? null,
      action: action.action,
      note: action.note ?? null,
    })),
  }

  const { data, error } = await safeApiCall<InspectionSessionDto>(
    `/fridge/inspections/${sessionId}/actions`,
    {
      method: "POST",
      body: payload,
    },
  )

  if (error || !data) {
    throw new Error(error?.message ?? "검사 조치 기록에 실패했습니다.")
  }

  return mapInspectionSessionDto(data)
}

export async function deleteInspectionAction(sessionId: string, actionId: number): Promise<InspectionSession> {
  const { data, error } = await safeApiCall<InspectionSessionDto>(
    `/fridge/inspections/${sessionId}/actions/${actionId}`,
    {
      method: "DELETE",
    },
  )
  if (error || !data) {
    throw new Error(error?.message ?? "검사 조치를 되돌리지 못했습니다.")
  }
  return mapInspectionSessionDto(data)
}

export async function submitInspection(sessionId: string, payload: InspectionSubmitPayload): Promise<InspectionSession> {
  const { data, error } = await safeApiCall<InspectionSessionDto>(
    `/fridge/inspections/${sessionId}/submit`,
    {
      method: "POST",
      body: payload,
    },
  )
  if (error || !data) {
    throw new Error(error?.message ?? "검사 제출에 실패했습니다.")
  }
  return mapInspectionSessionDto(data)
}

type InspectionHistoryParams = {
  slotId?: string
  status?: InspectionSession["status"]
  limit?: number
}

export async function fetchInspectionHistory(params: InspectionHistoryParams = {}): Promise<InspectionSession[]> {
  if (isFixtureMode()) {
    const fixture = await fetchFixture<InspectionSessionDto[]>("history")
    if (!fixture) return []
    return fixture.map(mapInspectionSessionDto)
  }

  const search = new URLSearchParams()
  if (params.slotId) search.set("slotId", params.slotId)
  if (params.status) search.set("status", params.status)
  if (typeof params.limit === "number") search.set("limit", String(params.limit))
  const path = search.toString() ? `/fridge/inspections?${search.toString()}` : "/fridge/inspections"

  const { data, error } = await safeApiCall<InspectionSessionDto[]>(path, { method: "GET" })
  if (error) {
    if (error.status === 204 || error.status === 404) return []
    if (error.status === 403 && (error.code === "FORBIDDEN_SLOT" || error.code === "FLOOR_SCOPE_VIOLATION")) {
      return []
    }
    throw new Error(error.message ?? "검사 기록을 불러오지 못했습니다.")
  }

  if (!data) return []
  return data.map(mapInspectionSessionDto)
}

export async function fetchInspectionSlots(): Promise<Slot[]> {
  if (isFixtureMode()) {
    const fixture = await fetchFixture<FridgeSlotListResponseDto>("slots")
    const items = fixture?.items ?? []
    return items.map(mapSlotFromDto)
  }

  const { data, error } = await safeApiCall<FridgeSlotListResponseDto>(
    "/fridge/slots?view=full&page=0&size=200",
    { method: "GET" },
  )
  if (error || !data) {
    throw new Error(error?.message ?? "검사 대상 칸 정보를 불러오지 못했습니다.")
  }
  const items = data.items ?? []
  return items.map(mapSlotFromDto)
}

type InspectionScheduleParams = {
  status?: InspectionSchedule["status"]
  limit?: number
  floor?: number
  compartmentIds?: string[]
}

export async function fetchInspectionSchedules(
  params: InspectionScheduleParams = {},
): Promise<InspectionSchedule[]> {
  if (isFixtureMode()) {
    const fixture = await fetchFixture<InspectionScheduleDto[]>("schedules")
    if (!fixture) return []
    return fixture.map(mapScheduleDto)
  }

  const search = new URLSearchParams()
  if (params.status) search.set("status", params.status)
  if (typeof params.limit === "number") search.set("limit", String(params.limit))
  if (typeof params.floor === "number") search.set("floor", String(params.floor))
  if (params.compartmentIds && params.compartmentIds.length > 0) {
    params.compartmentIds.forEach((id) => {
      if (id) {
        search.append("compartmentId", id)
      }
    })
  }
  const path = search.toString() ? `/fridge/inspection-schedules?${search.toString()}` : "/fridge/inspection-schedules"

  const { data, error } = await safeApiCall<InspectionScheduleDto[]>(path, { method: "GET" })
  if (error) {
    if (error.status === 204 || error.status === 404) return []
    throw new Error(error.message ?? "검사 일정을 불러오지 못했습니다.")
  }
  if (!data) return []
  return data.map(mapScheduleDto)
}

export async function fetchNextInspectionSchedule(): Promise<InspectionSchedule | null> {
  const { data, error } = await safeApiCall<InspectionScheduleDto>("/fridge/inspection-schedules/next", {
    method: "GET",
  })
  if (error) {
    if (error.status === 204 || error.status === 404) return null
    throw new Error(error.message ?? "다음 검사 일정을 불러오지 못했습니다.")
  }
  if (!data) return null
  return mapScheduleDto(data)
}

type CreateInspectionSchedulePayload = {
  scheduledAt: string
  title?: string | null
  notes?: string | null
  fridgeCompartmentId?: string | null
}

export async function createInspectionSchedule(
  payload: CreateInspectionSchedulePayload,
): Promise<InspectionSchedule | null> {
  const body = {
    scheduledAt: payload.scheduledAt,
    title: payload.title ?? undefined,
    notes: payload.notes ?? undefined,
    fridgeCompartmentId: payload.fridgeCompartmentId ?? undefined,
  }
  const { data, error } = await safeApiCall<InspectionScheduleDto>("/fridge/inspection-schedules", {
    method: "POST",
    body,
  })
  if (error) {
    if (error.code === "SCHEDULE_CONFLICT") {
      throw new Error("이미 같은 시간대에 예약된 검사 일정이 있습니다.")
    }
    throw new Error(error.message ?? "검사 일정을 생성하지 못했습니다.")
  }
  return data ? mapScheduleDto(data) : null
}

type UpdateInspectionSchedulePayload = {
  scheduledAt?: string
  title?: string | null
  notes?: string | null
  status?: InspectionSchedule["status"]
  completedAt?: string | null
  inspectionSessionId?: string | null
  detachInspectionSession?: boolean
  fridgeCompartmentId?: string
}

export async function updateInspectionSchedule(
  scheduleId: string,
  payload: UpdateInspectionSchedulePayload,
): Promise<InspectionSchedule | null> {
  const body: Record<string, unknown> = {}
  if (payload.scheduledAt) body.scheduledAt = payload.scheduledAt
  if (payload.title !== undefined) body.title = payload.title ?? null
  if (payload.notes !== undefined) body.notes = payload.notes ?? null
  if (payload.status) body.status = payload.status
  if (payload.completedAt !== undefined) body.completedAt = payload.completedAt
  if (payload.inspectionSessionId !== undefined) body.inspectionSessionId = payload.inspectionSessionId
  if (payload.detachInspectionSession) body.detachInspectionSession = true
  if (payload.fridgeCompartmentId !== undefined) body.fridgeCompartmentId = payload.fridgeCompartmentId

  const { data, error } = await safeApiCall<InspectionScheduleDto>(`/fridge/inspection-schedules/${scheduleId}`, {
    method: "PATCH",
    body,
  })
  if (error) {
    if (error.code === "SCHEDULE_CONFLICT") {
      throw new Error("이미 같은 시간대에 예약된 검사 일정이 있습니다.")
    }
    throw new Error(error.message ?? "검사 일정을 수정하지 못했습니다.")
  }
  return data ? mapScheduleDto(data) : null
}

export async function deleteInspectionSchedule(scheduleId: string): Promise<void> {
  const { error } = await safeApiCall(`/fridge/inspection-schedules/${scheduleId}`, {
    method: "DELETE",
    parseResponseAs: "none",
  })
  if (error) {
    if (error.status === 404 || error.code === "SCHEDULE_NOT_FOUND") {
      return
    }
    throw new Error(error.message ?? "검사 일정을 삭제하지 못했습니다.")
  }
}

function mapInspectionSessionDto(dto: InspectionSessionDto): InspectionSession {
  const bundles: Bundle[] = []
  const units: ItemUnit[] = []

  dto.bundles.forEach((bundleDto) => {
    const { bundle, units: mappedUnits } = mapBundleFromDto(bundleDto, undefined)
    bundles.push(bundle)
    units.push(...mappedUnits)
  })

  const items = toItems(bundles, units)
  const actions = (dto.actions ?? []).map((action) => ({
    actionId: action.actionId,
    actionType: action.actionType,
    bundleId: action.bundleId ?? null,
    targetUserId: action.targetUserId ?? null,
    recordedAt: action.recordedAt,
    recordedBy: action.recordedBy ?? null,
    note: action.note ?? null,
    correlationId: action.correlationId ?? null,
    items: (action.items ?? []).map((item) => ({
      id: item.id,
      fridgeItemId: item.fridgeItemId ?? null,
      snapshotName: item.snapshotName ?? null,
      snapshotExpiresOn: item.snapshotExpiresOn ?? null,
      quantityAtAction: item.quantityAtAction ?? null,
      correlationId: item.correlationId ?? null,
    })),
    penalties: (action.penalties ?? []).map((penalty) => ({
      id: penalty.id,
      points: penalty.points,
      reason: penalty.reason ?? null,
      issuedAt: penalty.issuedAt,
      expiresAt: penalty.expiresAt ?? null,
      correlationId: penalty.correlationId ?? null,
    })),
  }))

  return {
    sessionId: dto.sessionId,
    slotId: dto.slotId,
    slotIndex: dto.slotIndex,
    slotLetter: dto.slotLabel && dto.slotLabel.length > 0 ? dto.slotLabel : toSlotLetter(dto.slotIndex),
    floorNo: dto.floorNo,
    floorCode: dto.floorCode ?? null,
    status: dto.status,
    startedBy: dto.startedBy,
    startedAt: dto.startedAt,
    endedAt: dto.endedAt ?? null,
    bundles,
    units,
    items,
    summary: dto.summary ?? [],
    actions,
    notes: dto.notes ?? null,
    initialBundleCount: dto.initialBundleCount ?? bundles.length,
    totalBundleCount: dto.totalBundleCount ?? bundles.length,
  }
}

function mapScheduleDto(dto: InspectionScheduleDto): InspectionSchedule {
  return {
    scheduleId: dto.scheduleId,
    scheduledAt: dto.scheduledAt,
    title: dto.title ?? null,
    notes: dto.notes ?? null,
    status: dto.status,
    completedAt: dto.completedAt ?? null,
    inspectionSessionId: dto.inspectionSessionId ?? null,
    fridgeCompartmentId: dto.fridgeCompartmentId ?? null,
    slotIndex: dto.slotIndex ?? null,
    slotLetter: dto.slotLetter ?? null,
    floorNo: dto.floorNo ?? null,
    floorCode: dto.floorCode ?? null,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
  }
}

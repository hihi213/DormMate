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
}

type PenaltyHistoryDto = {
  id: string
  points: number
  reason?: string | null
  issuedAt: string
  expiresAt?: string | null
}

type InspectionActionDetailDto = {
  actionId: number
  actionType: InspectionAction
  bundleId?: string | null
  targetUserId?: string | null
  recordedAt: string
  recordedBy?: string | null
  note?: string | null
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
}

type InspectionScheduleDto = {
  scheduleId: string
  scheduledAt: string
  title?: string | null
  notes?: string | null
  status: InspectionSchedule["status"]
  completedAt?: string | null
  inspectionSessionId?: string | null
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
}

export async function fetchInspectionSchedules(
  params: InspectionScheduleParams = {},
): Promise<InspectionSchedule[]> {
  const search = new URLSearchParams()
  if (params.status) search.set("status", params.status)
  if (typeof params.limit === "number") search.set("limit", String(params.limit))
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
}

export async function createInspectionSchedule(
  payload: CreateInspectionSchedulePayload,
): Promise<InspectionSchedule> {
  const body = {
    scheduledAt: payload.scheduledAt,
    title: payload.title ?? undefined,
    notes: payload.notes ?? undefined,
  }
  const { data, error } = await safeApiCall<InspectionScheduleDto>("/fridge/inspection-schedules", {
    method: "POST",
    body,
  })
  if (error || !data) {
    throw new Error(error?.message ?? "검사 일정을 생성하지 못했습니다.")
  }
  return mapScheduleDto(data)
}

type UpdateInspectionSchedulePayload = {
  scheduledAt?: string
  title?: string | null
  notes?: string | null
  status?: InspectionSchedule["status"]
  completedAt?: string | null
  inspectionSessionId?: string | null
  detachInspectionSession?: boolean
}

export async function updateInspectionSchedule(
  scheduleId: string,
  payload: UpdateInspectionSchedulePayload,
): Promise<InspectionSchedule> {
  const body: Record<string, unknown> = {}
  if (payload.scheduledAt) body.scheduledAt = payload.scheduledAt
  if (payload.title !== undefined) body.title = payload.title ?? null
  if (payload.notes !== undefined) body.notes = payload.notes ?? null
  if (payload.status) body.status = payload.status
  if (payload.completedAt !== undefined) body.completedAt = payload.completedAt
  if (payload.inspectionSessionId !== undefined) body.inspectionSessionId = payload.inspectionSessionId
  if (payload.detachInspectionSession) body.detachInspectionSession = true

  const { data, error } = await safeApiCall<InspectionScheduleDto>(`/fridge/inspection-schedules/${scheduleId}`, {
    method: "PATCH",
    body,
  })
  if (error || !data) {
    throw new Error(error?.message ?? "검사 일정을 수정하지 못했습니다.")
  }
  return mapScheduleDto(data)
}

export async function deleteInspectionSchedule(scheduleId: string): Promise<void> {
  const { error } = await safeApiCall(`/fridge/inspection-schedules/${scheduleId}`, {
    method: "DELETE",
    parseResponseAs: "none",
  })
  if (error) {
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
    items: (action.items ?? []).map((item) => ({
      id: item.id,
      fridgeItemId: item.fridgeItemId ?? null,
      snapshotName: item.snapshotName ?? null,
      snapshotExpiresOn: item.snapshotExpiresOn ?? null,
      quantityAtAction: item.quantityAtAction ?? null,
    })),
    penalties: (action.penalties ?? []).map((penalty) => ({
      id: penalty.id,
      points: penalty.points,
      reason: penalty.reason ?? null,
      issuedAt: penalty.issuedAt,
      expiresAt: penalty.expiresAt ?? null,
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
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
  }
}

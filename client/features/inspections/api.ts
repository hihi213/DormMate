import { safeApiCall } from "@/lib/api-client"
import { mapBundleFromDto, toItems } from "@/features/fridge/utils/data-shaping"
import type { Bundle, ItemUnit, Slot } from "@/features/fridge/types"
import { mapSlotFromDto } from "@/features/fridge/utils/data-shaping"
import type {
  InspectionAction,
  InspectionActionEntry,
  InspectionSession,
  InspectionSubmitPayload,
} from "@/features/inspections/types"

type InspectionActionSummaryDto = {
  action: InspectionAction
  count: number
}

type InspectionSessionDto = {
  sessionId: number
  slotId?: string | null
  slotCode: string
  floorCode?: string | null
  status: InspectionSession["status"]
  startedBy: string
  startedAt: string
  endedAt?: string | null
  bundles: any[]
  summary: InspectionActionSummaryDto[]
  notes?: string | null
}

type StartInspectionRequest = {
  slotId: string
  slotCode?: string | null
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
  const { data, error } = await safeApiCall<InspectionSessionDto>("/fridge/inspections", {
    method: "POST",
    body: payload,
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
    throw new Error(result.error.message ?? "검사 세션을 조회하지 못했습니다.")
  }

  if (!result.data) return null
  return mapInspectionSessionDto(result.data)
}

export async function fetchInspection(sessionId: number): Promise<InspectionSession> {
  const { data, error } = await safeApiCall<InspectionSessionDto>(`/fridge/inspections/${sessionId}`, {
    method: "GET",
  })
  if (error || !data) {
    throw new Error(error?.message ?? "검사 세션을 불러오지 못했습니다.")
  }
  return mapInspectionSessionDto(data)
}

export async function cancelInspection(sessionId: number): Promise<void> {
  const { error } = await safeApiCall(`/fridge/inspections/${sessionId}`, {
    method: "DELETE",
    parseResponseAs: "none",
  })
  if (error) {
    throw new Error(error.message ?? "검사 세션을 취소하지 못했습니다.")
  }
}

export async function recordInspectionActions(
  sessionId: number,
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

export async function submitInspection(sessionId: number, payload: InspectionSubmitPayload): Promise<InspectionSession> {
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

export async function fetchInspectionSlots(): Promise<Slot[]> {
  const { data, error } = await safeApiCall<any[]>("/fridge/slots?view=full&size=200", { method: "GET" })
  if (error || !data) {
    throw new Error(error?.message ?? "검사 대상 칸 정보를 불러오지 못했습니다.")
  }
  return data.map(mapSlotFromDto)
}

function mapInspectionSessionDto(dto: InspectionSessionDto): InspectionSession {
  const bundles: Bundle[] = []
  const units: ItemUnit[] = []

  dto.bundles.forEach((bundleDto, index) => {
    const { bundle, units: mappedUnits } = mapBundleFromDto(bundleDto, undefined)
    bundles.push(bundle)
    units.push(...mappedUnits)
  })

  const items = toItems(bundles, units)

  return {
    sessionId: dto.sessionId,
    slotId: dto.slotId ?? undefined,
    slotCode: dto.slotCode,
    floorCode: dto.floorCode ?? null,
    status: dto.status,
    startedBy: dto.startedBy,
    startedAt: dto.startedAt,
    endedAt: dto.endedAt ?? null,
    bundles,
    units,
    items,
    summary: dto.summary ?? [],
    notes: dto.notes ?? null,
  }
}


import { safeApiCall } from "@/lib/api-client"
import type { components } from "@/lib/api-types"
import type { ApiError } from "@/lib/api-errors"

type FridgeSlotDto = components["schemas"]["FridgeSlot"]
type BundleSummaryDto = components["schemas"]["FridgeBundleSummary"]
type BundleListResponseDto = components["schemas"]["BundleListResponse"]
type InspectionSessionDto = components["schemas"]["InspectionSession"]
type UpdateInspectionSessionRequestDto = components["schemas"]["UpdateInspectionSessionRequest"]
type InspectionScheduleDto = components["schemas"]["InspectionSchedule"]
type ReallocationPreviewResponseDto = components["schemas"]["ReallocationPreviewResponse"]
type ReallocationApplyRequestDto = components["schemas"]["ReallocationApplyRequest"]
type ReallocationApplyResponseDto = components["schemas"]["ReallocationApplyResponse"]

type RaisedApiError = Error & { status?: number; code?: string }

function raiseAdminFridgeError(error: ApiError | undefined, fallbackMessage: string): never {
  const message = error?.message ?? fallbackMessage
  const richError: RaisedApiError = new Error(message)
  if (error) {
    richError.status = error.status
    richError.code = error.code
  }
  throw richError
}

export type FetchAdminCompartmentsParams = {
  floor?: number
  view?: "basic" | "full"
}

export async function fetchAdminCompartments(
  params: FetchAdminCompartmentsParams = {},
): Promise<FridgeSlotDto[]> {
  const search = new URLSearchParams()
  if (typeof params.floor === "number") {
    search.set("floor", String(params.floor))
  }
  search.set("view", params.view ?? "full")

  const query = search.toString()
  const path = query.length > 0 ? `/admin/fridge/compartments?${query}` : "/admin/fridge/compartments"

  const { data, error } = await safeApiCall<FridgeSlotDto[]>(path, {
    method: "GET",
  })

  if (error || !data) {
    raiseAdminFridgeError(error, "냉장고 칸 정보를 불러오지 못했습니다.")
  }

  return data
}

export type BundleSearchParams = {
  slotId?: string
  owner?: "me" | "all"
  ownerUserId?: string
  status?: "active" | "deleted"
  search?: string
  page?: number
  size?: number
}

export async function fetchAdminBundleList(
  params: BundleSearchParams = {},
): Promise<BundleListResponseDto> {
  const search = new URLSearchParams()

  if (params.slotId) {
    search.set("slotId", params.slotId)
  }
  if (params.ownerUserId) {
    search.set("ownerUserId", params.ownerUserId)
  }
  search.set("owner", params.owner ?? "all")
  search.set("status", params.status ?? "active")

  const trimmedSearch = params.search?.trim()
  if (trimmedSearch) {
    search.set("search", trimmedSearch)
  }

  const page = Number.isInteger(params.page) ? Number(params.page) : 0
  const size = Number.isInteger(params.size) ? Number(params.size) : 20
  search.set("page", String(Math.max(0, page)))
  search.set("size", String(Math.max(1, size)))

  const path = `/fridge/bundles?${search.toString()}`

  const { data, error } = await safeApiCall<BundleListResponseDto>(path, {
    method: "GET",
  })

  if (error || !data) {
    raiseAdminFridgeError(error, "포장 목록을 불러오지 못했습니다.")
  }

  return data
}

export type FetchDeletedBundlesParams = {
  slotId?: string
  since?: string
  page?: number
  size?: number
  search?: string
}

export async function fetchAdminDeletedBundles(
  params: FetchDeletedBundlesParams = {},
): Promise<BundleListResponseDto> {
  const search = new URLSearchParams()

  const trimmedSearch = params.search?.trim()
  if (trimmedSearch) {
    search.set("search", trimmedSearch)
  }

  const trimmedSince = params.since?.trim()
  if (trimmedSince) {
    search.set("since", trimmedSince)
  }
  if (params.slotId) {
    search.set("slotId", params.slotId)
  }

  const page = Number.isInteger(params.page) ? Number(params.page) : 0
  const size = Number.isInteger(params.size) ? Number(params.size) : 20
  search.set("page", String(Math.max(0, page)))
  search.set("size", String(Math.max(1, size)))

  const query = search.toString()
  const path =
    query.length > 0
      ? `/admin/fridge/bundles/deleted?${query}`
      : "/admin/fridge/bundles/deleted"

  const { data, error } = await safeApiCall<BundleListResponseDto>(path, {
    method: "GET",
  })

  if (error || !data) {
    raiseAdminFridgeError(error, "삭제된 포장 이력을 불러오지 못했습니다.")
  }

  return data
}

export type FetchInspectionSessionsParams = {
  slotId: string
  status?: "IN_PROGRESS" | "SUBMITTED" | "CANCELED" | "CANCELLED"
  limit?: number
}

export async function fetchAdminInspectionSessions(
  params: FetchInspectionSessionsParams,
): Promise<InspectionSessionDto[]> {
  const search = new URLSearchParams()
  search.set("slotId", params.slotId)

  if (params.status) {
    search.set("status", params.status)
  }

  const limit = Number.isInteger(params.limit) ? Number(params.limit) : 5
  if (limit > 0) {
    search.set("limit", String(limit))
  }

  const path = `/fridge/inspections?${search.toString()}`

  const { data, error } = await safeApiCall<InspectionSessionDto[]>(path, {
    method: "GET",
  })

  if (error || !data) {
    raiseAdminFridgeError(error, "검사 이력을 불러오지 못했습니다.")
  }

  return data
}

export async function updateAdminInspectionSession(
  sessionId: string,
  payload: UpdateInspectionSessionRequestDto,
): Promise<InspectionSessionDto> {
  const { data, error } = await safeApiCall<InspectionSessionDto>(`/fridge/inspections/${sessionId}`, {
    method: "PATCH",
    body: payload,
  })

  if (error || !data) {
    raiseAdminFridgeError(error, "검사 정정에 실패했습니다.")
  }

  return data
}

export async function resendInspectionNotification(
  sessionId: string,
): Promise<InspectionSessionDto> {
  const { data, error } = await safeApiCall<InspectionSessionDto>(
    `/fridge/inspections/${sessionId}/notifications/resend`,
    {
      method: "POST",
    },
  )

  if (error || !data) {
    raiseAdminFridgeError(error, "검사 결과 알림을 재발송하지 못했습니다.")
  }

  return data
}

export async function previewReallocation(
  floor: number,
): Promise<ReallocationPreviewResponseDto> {
  const { data, error } = await safeApiCall<ReallocationPreviewResponseDto>(
    "/admin/fridge/reallocations/preview",
    {
      method: "POST",
      body: { floor },
    },
  )

  if (error || !data) {
    raiseAdminFridgeError(error, "재배분 추천안을 불러오지 못했습니다.")
  }

  return data
}

export async function applyReallocation(
  payload: ReallocationApplyRequestDto,
): Promise<ReallocationApplyResponseDto> {
  const { data, error } = await safeApiCall<ReallocationApplyResponseDto>(
    "/admin/fridge/reallocations/apply",
    {
      method: "POST",
      body: payload,
    },
  )

  if (error || !data) {
    raiseAdminFridgeError(error, "재배분 반영에 실패했습니다.")
  }

  return data
}

export type FridgeOwnershipIssueItem = {
  bundleId: string
  bundleName: string
  labelNumber: number | null
  ownerUserId: string
  ownerName?: string | null
  ownerLoginId?: string | null
  roomId?: string | null
  roomNumber?: string | null
  roomFloor?: number | null
  personalNo?: number | null
  fridgeCompartmentId: string
  slotIndex: number
  compartmentType?: string | null
  fridgeFloorNo?: number | null
  fridgeDisplayName?: string | null
  issueType: string
  createdAt?: string | null
  updatedAt?: string | null
}

export type FridgeOwnershipIssueResponse = {
  items: FridgeOwnershipIssueItem[]
  page: number
  size: number
  totalElements: number
  totalPages: number
}

export type FetchFridgeOwnershipIssueParams = {
  page?: number
  size?: number
  ownerId?: string
}

export async function fetchFridgeOwnershipIssues(
  params: FetchFridgeOwnershipIssueParams = {},
): Promise<FridgeOwnershipIssueResponse> {
  const search = new URLSearchParams()
  const page = Number.isInteger(params.page) ? Number(params.page) : 0
  const size = Number.isInteger(params.size) ? Number(params.size) : 20

  search.set("page", String(Math.max(0, page)))
  search.set("size", String(Math.min(Math.max(1, size), 100)))
  if (params.ownerId) {
    search.set("ownerId", params.ownerId)
  }

  const path = `/admin/fridge/issues?${search.toString()}`
  const { data, error } = await safeApiCall<FridgeOwnershipIssueResponse>(path, {
    method: "GET",
  })

  if (error || !data) {
    raiseAdminFridgeError(error, "냉장고 권한 불일치 목록을 불러오지 못했습니다.")
  }

  return data
}

export type {
  BundleSummaryDto as AdminBundleSummaryDto,
  BundleListResponseDto as AdminBundleListResponseDto,
  FridgeSlotDto as AdminFridgeSlotDto,
  InspectionSessionDto as AdminInspectionSessionDto,
  UpdateInspectionSessionRequestDto as AdminUpdateInspectionSessionRequestDto,
  InspectionScheduleDto as AdminInspectionScheduleDto,
  ReallocationPreviewResponseDto as AdminReallocationPreviewDto,
  ReallocationApplyRequestDto as AdminReallocationApplyRequestDto,
  ReallocationApplyResponseDto as AdminReallocationApplyResponseDto,
}

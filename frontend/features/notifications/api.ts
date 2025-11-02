import { safeApiCall } from "@/lib/api-client"
import type { ApiError } from "@/lib/api-errors"
import type {
  NotificationActionResult,
  NotificationList,
  NotificationPreference,
  NotificationPreferenceUpdateInput,
  NotificationStateFilter,
  UpdateNotificationPreferenceRequestDto,
} from "@/features/notifications/types"
import {
  mapNotificationListFromDto,
  mapPreferenceFromDto,
} from "@/features/notifications/utils/transform"
import type {
  NotificationListResponseDto,
  NotificationPreferenceDto,
  NotificationPreferenceResponseDto,
} from "@/features/notifications/types"

const DEFAULT_ERROR_MESSAGE = "알림 정보를 불러오지 못했습니다."

function toErrorResult<T = void>(
  error: ApiError | undefined,
  fallback = DEFAULT_ERROR_MESSAGE,
): NotificationActionResult<T> {
  if (!error) {
    return { success: false, error: fallback }
  }
  return {
    success: false,
    error: error.message || fallback,
    code: error.code,
  }
}

export async function fetchNotifications(params: {
  state?: NotificationStateFilter
  page?: number
  size?: number
} = {}): Promise<NotificationActionResult<NotificationList>> {
  const search = new URLSearchParams()
  const state = (params.state ?? "all").toLowerCase() as NotificationStateFilter
  search.set("state", state)

  if (typeof params.page === "number") {
    search.set("page", String(Math.max(params.page, 0)))
  }
  if (typeof params.size === "number") {
    search.set("size", String(Math.max(params.size, 1)))
  }

  const { data, error } = await safeApiCall<NotificationListResponseDto>(`/notifications?${search.toString()}`, {
    method: "GET",
  })

  if (error || !data) {
    return toErrorResult(error)
  }

  return {
    success: true,
    data: mapNotificationListFromDto(data),
  }
}

export async function markNotificationAsRead(notificationId: string): Promise<NotificationActionResult> {
  if (!notificationId) {
    return { success: false, error: "알림 ID가 필요합니다." }
  }

  const { error } = await safeApiCall<unknown>(`/notifications/${notificationId}/read`, {
    method: "PATCH",
    parseResponseAs: "none",
  })

  if (error) {
    return toErrorResult(error, "알림을 읽음 처리하지 못했습니다.")
  }

  return { success: true }
}

export async function markAllNotificationsAsRead(): Promise<NotificationActionResult> {
  const { error } = await safeApiCall<unknown>("/notifications/read-all", {
    method: "PATCH",
    parseResponseAs: "none",
  })

  if (error) {
    return toErrorResult(error, "모든 알림을 읽음 처리하지 못했습니다.")
  }

  return { success: true }
}

export async function fetchNotificationPreferences(): Promise<NotificationActionResult<NotificationPreference[]>> {
  const { data, error } = await safeApiCall<NotificationPreferenceResponseDto>("/notifications/preferences", {
    method: "GET",
  })

  if (error || !data) {
    return toErrorResult(error, "알림 설정을 불러오지 못했습니다.")
  }

  const items = (data.items ?? []).map(mapPreferenceFromDto)

  return {
    success: true,
    data: items,
  }
}

export async function updateNotificationPreference(
  kindCode: string,
  payload: NotificationPreferenceUpdateInput,
): Promise<NotificationActionResult<NotificationPreference>> {
  const trimmedKindCode = kindCode.trim()
  if (!trimmedKindCode) {
    return { success: false, error: "알림 종류 코드가 필요합니다." }
  }

  const body: UpdateNotificationPreferenceRequestDto = {
    enabled: payload.enabled,
    allowBackground: payload.allowBackground,
  }

  const { data, error } = await safeApiCall<NotificationPreferenceDto>(
    `/notifications/preferences/${encodeURIComponent(trimmedKindCode)}`,
    {
      method: "PATCH",
      body,
    },
  )

  if (error || !data) {
    return toErrorResult(error, "알림 설정을 변경하지 못했습니다.")
  }

  return {
    success: true,
    data: mapPreferenceFromDto(data),
  }
}

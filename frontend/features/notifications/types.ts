import type { components } from "@/lib/api-types"

export type NotificationStateFilter = "all" | "unread" | "read"

export type NotificationDto = components["schemas"]["NotificationItem"]
export type NotificationListResponseDto = components["schemas"]["NotificationListResponse"]
export type NotificationPreferenceDto = components["schemas"]["NotificationPreferenceItem"]
export type NotificationPreferenceResponseDto = components["schemas"]["NotificationPreferenceResponse"]
export type UpdateNotificationPreferenceRequestDto = components["schemas"]["UpdateNotificationPreferenceRequest"]

export type NotificationState = NotificationDto["state"]

export type Notification = {
  id: string
  kindCode: string
  title: string
  body: string
  state: NotificationState
  createdAt: string
  readAt?: string | null
  ttlAt?: string | null
  correlationId?: string | null
  metadata?: Record<string, unknown>
}

export type NotificationList = {
  items: Notification[]
  page: number
  size: number
  totalElements: number
  unreadCount: number
}

export type NotificationPreference = {
  kindCode: string
  displayName: string
  description: string
  enabled: boolean
  allowBackground: boolean
}

export type NotificationPreferenceUpdateInput = {
  enabled: boolean
  allowBackground: boolean
}

export type NotificationActionResult<T = void> = {
  success: boolean
  data?: T
  error?: string
  code?: string
}

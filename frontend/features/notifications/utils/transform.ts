import type {
  Notification,
  NotificationDto,
  NotificationList,
  NotificationListResponseDto,
  NotificationPreference,
  NotificationPreferenceDto,
} from "@/features/notifications/types"

export function mapNotificationFromDto(dto: NotificationDto): Notification {
  return {
    id: dto.id,
    kindCode: dto.kindCode,
    title: dto.title,
    body: dto.body,
    state: dto.state,
    createdAt: dto.createdAt,
    readAt: dto.readAt ?? null,
    ttlAt: dto.ttlAt ?? null,
    correlationId: dto.correlationId ?? null,
    metadata: dto.metadata ?? undefined,
  }
}

export function mapNotificationListFromDto(dto: NotificationListResponseDto): NotificationList {
  const items = (dto.items ?? []).map(mapNotificationFromDto)
  return {
    items,
    page: dto.page,
    size: dto.size,
    totalElements: dto.totalElements,
    unreadCount: dto.unreadCount,
  }
}

export function mapPreferenceFromDto(dto: NotificationPreferenceDto): NotificationPreference {
  return {
    kindCode: dto.kindCode,
    displayName: dto.displayName,
    description: dto.description,
    enabled: dto.enabled,
    allowBackground: dto.allowBackground,
  }
}

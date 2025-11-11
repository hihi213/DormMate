import {
  AlertTriangle,
  Bell,
  BookOpen,
  DoorOpen,
  Gavel,
  ShieldAlert,
  Shirt,
  Snowflake,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

export type NotificationKindMeta = {
  kindCode: string
  module: string
  label: string
  description?: string
  href?: string
  icon: LucideIcon
  accentClassName: string
}

const NOTIFICATION_KIND_MAP: Record<string, NotificationKindMeta> = {
  FRIDGE_RESULT: {
    kindCode: "FRIDGE_RESULT",
    module: "냉장고",
    label: "검사 결과",
    href: "/fridge/inspections",
    icon: ShieldAlert,
    accentClassName: "text-rose-600",
  },
  FRIDGE_RESULT_ADMIN: {
    kindCode: "FRIDGE_RESULT_ADMIN",
    module: "관리자",
    label: "검사 조치 보고",
    description: "경고/폐기 조치가 포함된 검사 제출 시 관리자에게 전달됩니다.",
    href: "/admin/fridge",
    icon: ShieldAlert,
    accentClassName: "text-indigo-600",
  },
  FRIDGE_EXPIRY: {
    kindCode: "FRIDGE_EXPIRY",
    module: "냉장고",
    label: "임박 알림",
    href: "/fridge",
    icon: Snowflake,
    accentClassName: "text-amber-600",
  },
  FRIDGE_EXPIRED: {
    kindCode: "FRIDGE_EXPIRED",
    module: "냉장고",
    label: "만료 알림",
    href: "/fridge",
    icon: AlertTriangle,
    accentClassName: "text-rose-600",
  },
  LAUNDRY_EVENT: {
    kindCode: "LAUNDRY_EVENT",
    module: "세탁실",
    label: "세탁실 알림",
    href: "/laundry",
    icon: Shirt,
    accentClassName: "text-sky-600",
  },
  ROOM_PENALTY: {
    kindCode: "ROOM_PENALTY",
    module: "벌점",
    label: "벌점/상점",
    href: "/profile/penalties",
    icon: Gavel,
    accentClassName: "text-purple-600",
  },
  LIBRARY_NOTICE: {
    kindCode: "LIBRARY_NOTICE",
    module: "도서관",
    label: "도서관 알림",
    href: "/library",
    icon: BookOpen,
    accentClassName: "text-emerald-600",
  },
  STUDY_NOTICE: {
    kindCode: "STUDY_NOTICE",
    module: "스터디룸",
    label: "스터디룸 알림",
    href: "/study",
    icon: DoorOpen,
    accentClassName: "text-indigo-600",
  },
}

const DEFAULT_META: NotificationKindMeta = {
  kindCode: "UNKNOWN",
  module: "알림",
  label: "알림",
  icon: Bell,
  accentClassName: "text-slate-500",
  href: "/notifications",
}

export function resolveNotificationMeta(kindCode?: string): NotificationKindMeta {
  if (!kindCode) return DEFAULT_META
  const upper = kindCode.toUpperCase()
  return NOTIFICATION_KIND_MAP[upper] ?? DEFAULT_META
}

export function isFridgeNotification(kindCode: string): boolean {
  return kindCode.startsWith("FRIDGE_")
}

export function getModuleOrder(kindCode: string): number {
  if (kindCode.startsWith("FRIDGE_")) return 1
  if (kindCode.startsWith("LAUNDRY")) return 2
  if (kindCode.startsWith("LIBRARY")) return 3
  if (kindCode.startsWith("STUDY")) return 4
  if (kindCode.startsWith("ROOM_PENALTY")) return 5
  return 6
}

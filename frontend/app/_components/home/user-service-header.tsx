"use client"

import type { ComponentType, ReactNode } from "react"
import { Snowflake, Shirt, BookOpen, DoorOpen } from "lucide-react"

import type { AuthUser } from "@/lib/auth"
import HomeHeader from "./home-header"

type ServiceKey = "fridge" | "laundry" | "library" | "study"

type ServiceMeta = {
  label: string
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>
  textClass: string
}

const SERVICE_META: Record<ServiceKey, ServiceMeta> = {
  fridge: { label: "냉장고", icon: Snowflake, textClass: "text-emerald-700" },
  laundry: { label: "세탁실", icon: Shirt, textClass: "text-sky-700" },
  library: { label: "도서관", icon: BookOpen, textClass: "text-amber-800" },
  study: { label: "스터디룸", icon: DoorOpen, textClass: "text-violet-700" },
}

type UserServiceHeaderProps = {
  service: ServiceKey
  mounted: boolean
  user: AuthUser | null
  isAdmin: boolean
  onOpenInfo?: () => void
  onLogout: () => void
  contextSlotOverride?: ReactNode
}

export default function UserServiceHeader({
  service,
  mounted,
  user,
  isAdmin,
  onOpenInfo,
  onLogout,
  contextSlotOverride,
}: UserServiceHeaderProps) {
  const meta = SERVICE_META[service]
  const Icon = meta.icon
  const contextSlot =
    contextSlotOverride ??
    (
      <div className={`inline-flex items-center gap-2 ${meta.textClass}`}>
        <Icon className="h-5 w-5" aria-hidden />
        <span className="text-base font-semibold leading-none">{meta.label}</span>
      </div>
    )

  return (
    <HomeHeader
      mounted={mounted}
      isLoggedIn={Boolean(user)}
      user={user}
      isAdmin={isAdmin}
      onOpenInfo={onOpenInfo ?? (() => {})}
      onLogout={onLogout}
      contextSlot={contextSlot}
    />
  )
}

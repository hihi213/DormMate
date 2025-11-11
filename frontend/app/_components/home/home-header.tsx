"use client"

import { useCallback, useMemo, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { User } from "lucide-react"

import NotificationBell from "@/features/notifications/components/notification-bell"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { AuthUser } from "@/lib/auth"
import { redirectToLogin } from "@/lib/auth"

type Props = {
  mounted: boolean
  isLoggedIn: boolean
  user: AuthUser | null
  isAdmin: boolean
  onOpenInfo: () => void
  onLogout: () => void
  title?: string
  subtitle?: string | null
  contextSlot?: ReactNode
}

export default function HomeHeader({
  mounted,
  isLoggedIn,
  user,
  isAdmin,
  onOpenInfo,
  onLogout,
  title = "OO기숙사",
  subtitle,
  contextSlot,
}: Props) {
  const router = useRouter()
  const residentIdentifier = useMemo(() => {
    const roomNumberRaw = user?.roomDetails?.roomNumber?.trim()
    const floorNo =
      typeof user?.roomDetails?.floor === "number" ? user?.roomDetails?.floor : null
    const personalNo =
      typeof user?.roomDetails?.personalNo === "number" ? user?.roomDetails?.personalNo : null

    let combinedRoom = roomNumberRaw ?? ""
    if (floorNo != null && combinedRoom) {
      combinedRoom = combinedRoom.startsWith(String(floorNo))
        ? combinedRoom
        : `${floorNo}${combinedRoom}`
    } else if (floorNo != null && !combinedRoom) {
      combinedRoom = String(floorNo)
    }

    const roomWithPerson =
      combinedRoom && personalNo != null ? `${combinedRoom}-${personalNo}` : combinedRoom

    if (roomWithPerson) {
      return `${user?.name ?? ""} ${roomWithPerson}`.trim()
    }
    if (user?.room) return `${user?.name ?? ""} ${user.room}`.trim()
    return user?.name ?? ""
  }, [
    user?.room,
    user?.name,
    user?.roomDetails?.roomNumber,
    user?.roomDetails?.personalNo,
    user?.roomDetails?.floor,
  ])

  const navigateToLogin = useCallback(() => {
    const redirect =
      typeof window !== "undefined" ? window.location.pathname + window.location.search : undefined
    const target = redirectToLogin({ redirect })
    router.push(target)
  }, [router])

  return (
    <header className="sticky top-0 z-40 border-b bg-white/80 backdrop-blur">
      <div className="mx-auto grid max-w-screen-sm grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 py-3">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold leading-none">{title}</h1>
          {subtitle ? (
            <p className="text-xs text-muted-foreground leading-tight">{subtitle}</p>
          ) : mounted && isLoggedIn ? (
            <p className="text-xs text-muted-foreground leading-tight">{residentIdentifier}</p>
          ) : (
            <p className="text-xs text-muted-foreground leading-tight">{"로그인이 필요합니다"}</p>
          )}
        </div>
        <div className="flex items-center justify-center text-center">
          {contextSlot ? contextSlot : null}
        </div>
        <div className="flex items-center justify-end gap-2">
          <NotificationBell
            size={12}
            disabled={!mounted || !isLoggedIn}
            onRequireLogin={!isLoggedIn ? navigateToLogin : undefined}
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="inline-flex items-center justify-center rounded-full border w-9 h-9 bg-transparent"
                aria-label="마이페이지"
              >
                <User className="w-4 h-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {mounted && isLoggedIn ? (
                <>
                  <DropdownMenuLabel className="truncate">{`${user?.name ?? ""} · ${user?.room ?? ""}`}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {isAdmin && (
                    <DropdownMenuItem onClick={() => router.push("/admin")}>{"관리자 센터"}</DropdownMenuItem>
                  )}
                  {isAdmin && <DropdownMenuSeparator />}
                  <DropdownMenuItem onClick={() => router.push("/notifications")}>{"알림 센터"}</DropdownMenuItem>
                  <DropdownMenuItem onClick={onOpenInfo}>{"내정보"}</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={onLogout}>{"로그아웃"}</DropdownMenuItem>
                </>
              ) : (
                <>
                  <DropdownMenuLabel>{"로그인이 필요합니다"}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={navigateToLogin}>{"로그인"}</DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}

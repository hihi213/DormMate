"use client"

import { useCallback } from "react"
import { useRouter } from "next/navigation"
import { User } from "lucide-react"

import NotificationPermission from "@/components/notification-permission"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { AuthUser } from "@/lib/auth"

type Props = {
  mounted: boolean
  isLoggedIn: boolean
  user: AuthUser | null
  isAdmin: boolean
  onOpenInfo: () => void
  onLogout: () => void
}

export default function HomeHeader({
  mounted,
  isLoggedIn,
  user,
  isAdmin,
  onOpenInfo,
  onLogout,
}: Props) {
  const router = useRouter()

  const navigateToLogin = useCallback(() => {
    const redirect = typeof window !== "undefined" ? window.location.pathname : "/"
    router.push(`/auth/login?redirect=${encodeURIComponent(redirect)}`)
  }, [router])

  return (
    <header className="sticky top-0 z-40 border-b bg-white/80 backdrop-blur">
      <div className="mx-auto max-w-screen-sm px-4 py-3 flex items-center gap-3">
        <div className="flex-1">
          <h1 className="text-lg font-semibold leading-none">{"OO기숙사"}</h1>
          {mounted && isLoggedIn ? (
            <p className="text-xs text-muted-foreground leading-tight">{`${user?.name ?? ""} - ${user?.room ?? ""}`}</p>
          ) : (
            <p className="text-xs text-muted-foreground leading-tight">{"로그인이 필요합니다"}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <NotificationPermission />
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

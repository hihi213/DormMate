"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { formatDistanceToNowStrict } from "date-fns"
import { ko } from "date-fns/locale"
import { ArrowRight, BellDot, Check, Inbox, Loader2, RefreshCcw } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import { useNotifications } from "@/features/notifications"
import { resolveNotificationMeta } from "@/features/notifications/utils/metadata"
import type { NotificationStateFilter } from "@/features/notifications/types"

const PAGE_SIZE = 8

const FILTERS: { value: NotificationStateFilter; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "unread", label: "미읽음" },
  { value: "read", label: "읽음" },
]

function formatRelativeTime(timestamp: string): string {
  try {
    return formatDistanceToNowStrict(new Date(timestamp), { addSuffix: true, locale: ko })
  } catch {
    return "방금 전"
  }
}

export default function HeaderNotifications() {
  const router = useRouter()
  const { items, unreadCount, loading, error, ensureLoaded, refresh, markAsRead, markAllAsRead } =
    useNotifications()
  const [open, setOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [activeFilter, setActiveFilter] = useState<NotificationStateFilter>("all")

  useEffect(() => {
    if (typeof window === "undefined") return
    const mediaQuery = window.matchMedia("(max-width: 768px)")
    const update = () => setIsMobile(mediaQuery.matches)
    update()
    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", update)
      return () => mediaQuery.removeEventListener("change", update)
    }
    mediaQuery.addListener(update)
    return () => mediaQuery.removeListener(update)
  }, [])

  useEffect(() => {
    if (!open) return
    void ensureLoaded({ state: activeFilter, page: 0, size: PAGE_SIZE })
  }, [open, ensureLoaded, activeFilter])

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
  }

  const badgeLabel = useMemo(() => {
    if (unreadCount <= 0) return null
    if (unreadCount > 99) return "99+"
    return String(unreadCount)
  }, [unreadCount])

  const handleFilterChange = (value: NotificationStateFilter) => {
    if (value === activeFilter) return
    setActiveFilter(value)
  }

  const handleNavigate = async (notificationId: string) => {
    await markAsRead(notificationId)
    setOpen(false)
    router.push(`/admin/notifications?focus=${notificationId}`)
  }

  const handleMarkAll = async () => {
    if (unreadCount === 0) return
    await markAllAsRead()
    void ensureLoaded({ state: activeFilter, page: 0, size: PAGE_SIZE })
  }

  const handleRetry = async () => {
    await refresh()
    void ensureLoaded({ state: activeFilter, page: 0, size: PAGE_SIZE })
  }

  const emptyState = (
    <div className="flex flex-col items-center justify-center gap-3 py-8 text-center text-sm text-slate-500">
      <Inbox className="size-10 text-slate-300" aria-hidden />
      <div>
        <p className="font-medium text-slate-700">표시할 알림이 없습니다.</p>
        <p className="text-xs text-slate-500">최근 운영 알림이 도착하면 이곳에서 바로 확인할 수 있어요.</p>
      </div>
    </div>
  )

  const renderListSection = (variant: "popover" | "sheet") => {
    if (loading) {
      return (
        <div className="flex items-center justify-center gap-2 py-8 text-sm text-slate-500">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          알림을 불러오는 중입니다…
        </div>
      )
    }

    if (error) {
      return (
        <div className="flex flex-col items-center gap-3 px-4 py-8 text-center text-sm text-rose-600">
          <p className="font-medium">알림을 불러오지 못했습니다.</p>
          <p className="text-xs text-rose-500">{error}</p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-1"
            onClick={() => {
              void handleRetry()
            }}
          >
            <RefreshCcw className="size-3.5" aria-hidden />
            다시 시도
          </Button>
        </div>
      )
    }

    if (items.length === 0) {
      return emptyState
    }

    const list = (
      <ul className="divide-y divide-slate-100">
        {items.map((notification) => {
          const meta = resolveNotificationMeta(notification.kindCode)
          const Icon = meta.icon
          const unread = notification.state !== "READ"
          return (
            <li key={notification.id} className="group">
              <button
                type="button"
                className={cn(
                  "flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2",
                  unread ? "bg-emerald-50/60" : "",
                )}
                onClick={() => {
                  void handleNavigate(notification.id)
                }}
              >
                <span
                  className={cn(
                    "mt-1 inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-100",
                    meta.accentClassName,
                  )}
                >
                  <Icon className="size-4" aria-hidden />
                </span>
                <div className="flex flex-1 flex-col gap-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900 line-clamp-1">{notification.title}</p>
                    <span className="text-[11px] text-slate-400">
                      {formatRelativeTime(notification.createdAt)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 line-clamp-2">{notification.body}</p>
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                    <Badge variant="outline" className="border-slate-200 px-1.5 text-[11px] font-medium">
                      {meta.module}
                    </Badge>
                    {meta.href ? <span className="text-emerald-600">바로가기</span> : null}
                    {unread ? (
                      <span className="inline-flex items-center gap-1 text-emerald-600">
                        <span className="size-1.5 rounded-full bg-emerald-600" />
                        미읽음
                      </span>
                    ) : (
                      <span>읽음</span>
                    )}
                  </div>
                </div>
              </button>
            </li>
          )
        })}
      </ul>
    )

    if (variant === "popover") {
      return <ScrollArea className="max-h-80">{list}</ScrollArea>
    }

    return <div className="px-0 pb-4">{list}</div>
  }

  const triggerButton = (
    <Button variant="ghost" size="icon" className="relative" aria-label="알림 열기">
      <BellDot className="size-5 text-emerald-600" aria-hidden />
      {badgeLabel ? (
        <span className="absolute right-1 top-1 inline-flex min-w-[18px] items-center justify-center rounded-full bg-emerald-600 px-1 text-[10px] font-semibold leading-4 text-white">
          {badgeLabel}
        </span>
      ) : null}
    </Button>
  )

  const renderPanel = (variant: "popover" | "sheet") => (
    <div className={cn("flex flex-col", variant === "sheet" ? "h-full" : "")}>
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3 pr-8">
          <div>
            <p className="text-sm font-semibold text-slate-900">알림</p>
            <p className="text-xs text-slate-500">최근 24시간 내 발생한 운영 알림입니다.</p>
          </div>
          <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-8 gap-1 text-xs"
            disabled={unreadCount === 0}
            onClick={() => {
              void handleMarkAll()
            }}
          >
            <Check className="size-3.5" aria-hidden />
            모두 읽음
          </Button>
          {variant === "popover" ? (
            <Button
              asChild
              type="button"
              size="icon"
              variant="ghost"
              aria-label="알림 센터로 이동"
              className="rounded-full"
              onClick={() => setOpen(false)}
            >
              <Link href="/admin/notifications">
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            </Button>
          ) : null}
        </div>
      </div>
      <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-2 text-xs">
        {FILTERS.map((filter) => (
          <Button
            key={filter.value}
            type="button"
            size="sm"
            variant={filter.value === activeFilter ? "default" : "ghost"}
            className={cn(
              "h-7 rounded-full px-3",
              filter.value === activeFilter
                ? "bg-emerald-600 text-white hover:bg-emerald-600"
                : "text-slate-600 hover:text-emerald-600",
            )}
            onClick={() => handleFilterChange(filter.value)}
          >
            {filter.label}
            {filter.value === "unread" && unreadCount > 0 ? (
              <span className="ml-1 rounded-full bg-emerald-100 px-1.5 text-[10px] text-emerald-700">
                {badgeLabel}
              </span>
            ) : null}
          </Button>
        ))}
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="ml-auto size-7 rounded-full"
          aria-label="새로고침"
          onClick={() => {
            void handleRetry()
          }}
        >
          <RefreshCcw className="size-3.5" aria-hidden />
        </Button>
      </div>
      <div
        className={cn(
          "max-h-80",
          variant === "sheet" ? "flex-1 overflow-y-auto max-h-none px-4 pt-2" : "",
        )}
      >
        {renderListSection(variant)}
      </div>
      {variant === "sheet" ? (
        <div className="border-t border-slate-200 px-4 py-3">
          <Button
            type="button"
            className="w-full gap-1"
            onClick={() => {
              setOpen(false)
              router.push("/admin/notifications")
            }}
          >
            알림 센터로 이동
            <ArrowRight className="size-4" aria-hidden />
          </Button>
        </div>
      ) : null}
    </div>
  )

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetTrigger asChild>{triggerButton}</SheetTrigger>
        <SheetContent side="bottom" className="h-[85vh] p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>알림 센터</SheetTitle>
            <SheetDescription>최근 기숙사 알림을 확인하고 관리하세요</SheetDescription>
          </SheetHeader>
          {renderPanel("sheet")}
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>{triggerButton}</PopoverTrigger>
      <PopoverContent className="w-[min(360px,calc(100vw-2rem))] p-0 shadow-lg ring-1 ring-slate-200" align="end">
        {renderPanel("popover")}
      </PopoverContent>
    </Popover>
  )
}

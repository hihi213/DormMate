"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { formatDistanceToNow } from "date-fns"
import { ko } from "date-fns/locale"
import { Bell, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { useNotifications } from "@/features/notifications"
import { resolveNotificationMeta } from "@/features/notifications/utils/metadata"
import { cn } from "@/lib/utils"

const LOADING_SKELETONS = new Array(4).fill(null)

function formatRelativeTime(value: string): string {
  try {
    return formatDistanceToNow(new Date(value), { addSuffix: true, locale: ko })
  } catch {
    return "방금 전"
  }
}

type NotificationBellProps = {
  size?: number
  disabled?: boolean
  onRequireLogin?: () => void
}

export default function NotificationBell({ size = 10, disabled = false, onRequireLogin }: NotificationBellProps) {
  const router = useRouter()
  const {
    items,
    unreadCount,
    loading,
    error,
    filter,
    load,
    ensureLoaded,
    refresh,
    setFilter,
    markAsRead,
    markAllAsRead,
  } = useNotifications()
  const [open, setOpen] = useState(false)
  const [initializing, setInitializing] = useState(true)
  const [permissionSupported, setPermissionSupported] = useState(false)
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermission>("default")

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setPermissionSupported(true)
      setPermissionStatus(Notification.permission)
    } else {
      setPermissionSupported(false)
      setPermissionStatus("denied")
    }
  }, [])

  const canFetchNotifications = !disabled
  const pushPermissionGranted = permissionStatus === "granted"

  useEffect(() => {
    if (!canFetchNotifications) {
      setInitializing(false)
      return
    }
    let cancelled = false
    const init = async () => {
      const result = await ensureLoaded({ state: "all", page: 0, size })
      if (!cancelled) {
        if (!result.success && result.error) {
          console.warn("알림 초기화 실패", result.error)
        }
        setInitializing(false)
      }
    }
    void init()
    return () => {
      cancelled = true
    }
  }, [canFetchNotifications, ensureLoaded, size])

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (nextOpen === open) {
        return
      }
      setOpen(nextOpen)
    },
    [open],
  )

  const filterRef = useRef(filter)
  useEffect(() => {
    filterRef.current = filter
  }, [filter])

  useEffect(() => {
    if (!open || !canFetchNotifications) {
      return
    }
    void load({ state: filterRef.current, page: 0, size })
  }, [open, size, load, canFetchNotifications])

  const badgeLabel = useMemo(() => {
    if (unreadCount <= 0) return null
    if (unreadCount > 99) return "99+"
    return String(unreadCount)
  }, [unreadCount])

  const handleItemClick = useCallback(
    async (id: string, href?: string) => {
      if (id) {
        await markAsRead(id)
      }
      setOpen(false)
      if (href) {
        router.push(href)
      }
    },
    [markAsRead, router],
  )

  const handleMarkAll = useCallback(async () => {
    await markAllAsRead()
  }, [markAllAsRead])

  const handleRetry = useCallback(async () => {
    await refresh()
  }, [refresh])

  const requestPermission = useCallback(async () => {
    if (!permissionSupported) return
    try {
      const result = await Notification.requestPermission()
      setPermissionStatus(result)
      if (result === "granted" && "serviceWorker" in navigator) {
        const registration = await navigator.serviceWorker.getRegistration()
        await registration?.showNotification("알림이 활성화되었습니다", {
          body: "중요한 안내와 만료 알림을 받아볼 수 있어요.",
        })
      }
    } catch {
      // ignore
    }
  }, [permissionSupported])

  if (disabled) {
    return (
      <button
        type="button"
        className={cn(
          "relative inline-flex h-10 w-10 items-center justify-center rounded-full border bg-white transition-colors",
          "cursor-not-allowed opacity-60",
        )}
        aria-label="알림 보기"
        aria-disabled
        onClick={(event) => {
          event.preventDefault()
          event.stopPropagation()
          onRequireLogin?.()
        }}
      >
        <Bell className="h-4 w-4" aria-hidden="true" />
      </button>
    )
  }

  const showPushPrompt = permissionSupported && !pushPermissionGranted

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "relative inline-flex h-10 w-10 items-center justify-center rounded-full border bg-white transition-colors hover:bg-slate-100",
          )}
          aria-label="알림 보기"
        >
          <Bell className="h-4 w-4" aria-hidden="true" />
          {badgeLabel && (
            <span className="absolute -top-1 -right-1 min-w-[1.25rem] rounded-full bg-rose-600 px-1 text-center text-[10px] font-semibold leading-4 text-white">
              {badgeLabel}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[320px] max-w-[min(90vw,320px)] p-0 sm:max-w-[340px] overflow-hidden"
      >
        <div className="flex flex-col">
          <div className="border-b px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">알림</div>
              <Link
                href="/notifications"
                className="text-xs font-medium text-emerald-600 hover:underline"
                onClick={() => setOpen(false)}
              >
                알림 센터
              </Link>
            </div>
            <div className="mt-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1">
                {[
                  { key: "all" as const, label: "전체" },
                  { key: "unread" as const, label: "미읽음" },
                ].map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setFilter(option.key)}
                    className={cn(
                      "rounded-full border px-2 py-1 text-xs transition",
                      filter === option.key
                        ? "border-emerald-600 text-emerald-700"
                        : "border-transparent text-muted-foreground hover:border-slate-300",
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={handleMarkAll}
                className="rounded-full border px-2 py-1 text-xs text-muted-foreground hover:border-slate-300"
                disabled={unreadCount === 0}
              >
                모두 읽음
              </button>
            </div>
          </div>

          {showPushPrompt && (
            <div className="flex items-start justify-between gap-3 border-b bg-amber-50 px-4 py-2 text-xs text-amber-700">
              <span>브라우저 푸시 알림이 비활성화되어 있습니다.</span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 px-2 text-xs"
                onClick={() => void requestPermission()}
              >
                허용하기
              </Button>
            </div>
          )}

          <div className="border-b px-4 py-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {unreadCount > 0 ? `미읽음 ${unreadCount}개` : "새로운 알림이 없습니다"}
              </span>
              <button type="button" className="hover:text-emerald-600" onClick={handleRetry}>
                새로고침
              </button>
            </div>
          </div>

          <ScrollArea className="max-h-[60vh] sm:max-h-[360px]">
            <div className="divide-y">
              {initializing ? (
                <div className="space-y-3 px-4 py-4">
                  {LOADING_SKELETONS.map((_, idx) => (
                    <div key={idx} className="space-y-2">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-4 w-48" />
                    </div>
                  ))}
                </div>
              ) : error ? (
                <div className="space-y-2 px-4 py-6 text-center text-sm text-rose-600">
                  <p>알림을 불러오지 못했습니다.</p>
                  <Button size="sm" variant="outline" onClick={handleRetry}>
                    다시 시도
                  </Button>
                </div>
              ) : loading && items.length === 0 ? (
                <div className="space-y-3 px-4 py-4">
                  {LOADING_SKELETONS.map((_, idx) => (
                    <div key={idx} className="space-y-2">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-4 w-48" />
                    </div>
                  ))}
                </div>
              ) : items.length === 0 ? (
                <div className="px-4 py-6 text-sm text-muted-foreground">
                  표시할 알림이 없습니다.
                </div>
              ) : (
                items.map((item) => {
                  const meta = resolveNotificationMeta(item.kindCode)
                  const isUnread = item.state !== "READ"
                  const Icon = meta.icon
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={cn(
                        "flex w-full items-start gap-3 px-4 py-3 text-left transition",
                        isUnread ? "bg-emerald-50/60 hover:bg-emerald-100" : "hover:bg-slate-50",
                      )}
                      onClick={() => handleItemClick(item.id, meta.href)}
                    >
                      <div
                        className={cn(
                          "rounded-full border p-2",
                          isUnread ? "border-emerald-500" : "border-slate-200",
                        )}
                        aria-hidden="true"
                      >
                        <Icon className={cn("h-4 w-4", meta.accentClassName)} />
                      </div>
                      <div className="flex-1 space-y-0.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-medium text-muted-foreground">{meta.module}</span>
                          <span className="text-[11px] text-slate-400">{formatRelativeTime(item.createdAt)}</span>
                        </div>
                        <div className="text-sm font-semibold text-slate-900 line-clamp-1">{item.title}</div>
                        <div className="text-xs text-slate-700 line-clamp-2">{item.body}</div>
                      </div>
                      {isUnread && (
                        <span className="rounded-full border border-emerald-500 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">
                          NEW
                        </span>
                      )}
                    </button>
                  )
                })
              )}
            </div>
          </ScrollArea>
          {loading && items.length > 0 && (
            <div className="flex items-center gap-2 px-4 py-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>알림을 새로 고치는 중…</span>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

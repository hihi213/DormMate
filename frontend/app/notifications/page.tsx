"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowLeft,
  BellRing,
  CheckCheck,
  Loader2,
  RefreshCcw,
  ShieldAlert,
  Smartphone,
} from "lucide-react"
import { format, formatDistanceToNowStrict, parseISO } from "date-fns"

import AuthGuard from "@/features/auth/components/auth-guard"
import BottomNav from "@/components/bottom-nav"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/hooks/use-toast"
import {
  useNotificationPreferences,
  useNotifications,
} from "@/features/notifications/hooks/use-notifications"
import type { NotificationStateFilter } from "@/features/notifications/types"
import { resolveNotificationMeta } from "@/features/notifications/utils/metadata"
import { cn } from "@/lib/utils"
import { getDefaultErrorMessage } from "@/lib/api-errors"

const STATE_OPTIONS: Array<{ value: NotificationStateFilter; label: string }> = [
  { value: "all", label: "전체" },
  { value: "unread", label: "미읽음" },
  { value: "read", label: "읽음" },
]

function formatDateTime(value?: string | null, fallback = "정보 없음") {
  if (!value) return fallback
  try {
    return format(parseISO(value), "yyyy-MM-dd HH:mm")
  } catch (_error) {
    return fallback
  }
}

function formatRelative(value?: string | null) {
  if (!value) return ""
  try {
    return formatDistanceToNowStrict(parseISO(value), { addSuffix: true })
  } catch (_error) {
    return ""
  }
}

export default function NotificationsPage() {
  return (
    <AuthGuard>
      <NotificationCenter />
      <BottomNav />
    </AuthGuard>
  )
}

function NotificationCenter() {
  const router = useRouter()
  const { toast } = useToast()
  const {
    items,
    unreadCount,
    page,
    size,
    totalElements,
    loading: listLoading,
    error: listError,
    filter,
    load,
    setFilter,
    ensureLoaded,
    refresh,
    markAsRead,
    markAllAsRead,
    resetError,
  } = useNotifications()
  const {
    preferences,
    loading: prefLoading,
    error: prefError,
    loadPreferences,
    updatePreference,
    resetPreferenceError,
  } = useNotificationPreferences()
  const [permissionSupported, setPermissionSupported] = useState(false)
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermission>("default")

  useEffect(() => {
    void ensureLoaded({ state: "all", page: 0, size })
  }, [ensureLoaded, size])

  useEffect(() => {
    void loadPreferences()
  }, [loadPreferences])

  useEffect(() => {
    if (!listError) return
    toast({
      title: "알림을 불러올 수 없습니다.",
      description: listError,
      variant: "destructive",
    })
    resetError()
  }, [listError, resetError, toast])

  useEffect(() => {
    if (!prefError) return
    toast({
      title: "알림 설정을 불러올 수 없습니다.",
      description: prefError,
      variant: "destructive",
    })
    resetPreferenceError()
  }, [prefError, resetPreferenceError, toast])

  useEffect(() => {
    if (typeof window === "undefined") return
    if ("Notification" in window) {
      setPermissionSupported(true)
      setPermissionStatus(Notification.permission)
    } else {
      setPermissionSupported(false)
      setPermissionStatus("denied")
    }
  }, [])

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil((totalElements || 0) / Math.max(size, 1))),
    [totalElements, size],
  )

  const handleChangeFilter = (value: NotificationStateFilter) => {
    void setFilter(value)
  }

  const handlePageChange = (direction: "prev" | "next") => {
    const nextPage =
      direction === "prev" ? Math.max(0, page - 1) : Math.min(totalPages - 1, page + 1)
    void load({ state: filter, page: nextPage, size })
  }

  const handleMarkAll = async () => {
    const result = await markAllAsRead()
    if (!result.success) {
      const message =
        result.error ?? getDefaultErrorMessage(result.code) ?? "알림 작업 중 오류가 발생했습니다."
      toast({
        title: "모든 알림을 읽음 처리하지 못했습니다.",
        description: message,
        variant: "destructive",
      })
      return
    }
    toast({
      title: "모든 알림을 읽음 처리했습니다.",
      description: "미읽음 카운터가 초기화되었습니다.",
    })
  }

  const handleMarkSingle = async (notificationId: string) => {
    const result = await markAsRead(notificationId)
    if (!result.success) {
      const message =
        result.error ?? getDefaultErrorMessage(result.code) ?? "알림 작업 중 오류가 발생했습니다."
      toast({
        title: "알림을 읽음 처리하지 못했습니다.",
        description: message,
        variant: "destructive",
      })
      return
    }
    toast({
      title: "알림을 읽음 처리했습니다.",
    })
  }

  const handlePreferenceToggle = async (
    kindCode: string,
    field: "enabled" | "allowBackground",
    nextValue: boolean,
  ) => {
    const preference = preferences.find((item) => item.kindCode === kindCode)
    if (!preference) return
    const payload =
      field === "enabled"
        ? { enabled: nextValue, allowBackground: preference.allowBackground }
        : { enabled: preference.enabled, allowBackground: nextValue }

    const result = await updatePreference(kindCode, payload)
    if (!result.success) {
      toast({
        title: "알림 설정을 변경하지 못했습니다.",
        description: result.error,
        variant: "destructive",
      })
      return
    }
    toast({
      title: "알림 설정이 변경되었습니다.",
      description: `${kindCode} 설정이 저장되었습니다.`,
    })
  }

  const handleRequestPermission = async () => {
    if (!permissionSupported) return
    try {
      const next = await Notification.requestPermission()
      setPermissionStatus(next)
      if (next === "granted" && "serviceWorker" in navigator) {
        const registration = await navigator.serviceWorker.getRegistration()
        await registration?.showNotification("DormMate 알림이 활성화되었습니다.", {
          body: "중요 공지와 검사 결과를 받아볼 수 있어요.",
        })
      }
    } catch (error) {
      console.warn("Notification permission request failed", error)
    }
  }

  return (
    <main className="min-h-[100svh] bg-white pb-28">
      <header className="sticky top-0 z-40 border-b bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-screen-sm items-center gap-3 px-4 py-3">
          <button
            type="button"
            aria-label="이전으로 돌아가기"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border text-slate-600"
            onClick={() => (window.history.length > 1 ? router.back() : router.push("/"))}
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex-1">
            <p className="text-base font-semibold leading-tight">알림 센터</p>
            <p className="text-xs text-muted-foreground">검사·임박 알림을 확인하고 설정을 관리하세요.</p>
          </div>
          <Badge variant="outline" className="gap-1 border-emerald-200 bg-emerald-50 text-emerald-700">
            <BellRing className="h-3.5 w-3.5" />
            미읽음 {unreadCount}
          </Badge>
        </div>
      </header>

      <div className="mx-auto flex max-w-screen-sm flex-col gap-6 px-4 py-6">
        <Card className="shadow-sm">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base font-semibold">알림 타임라인</CardTitle>
              <CardDescription>검사 결과, 임박/만료 알림을 한곳에서 모아 봅니다.</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2">
                {STATE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleChangeFilter(option.value)}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs",
                      filter === option.value
                        ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                        : "border-slate-200 text-slate-500 hover:border-slate-400",
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="gap-1"
                onClick={() => void refresh()}
                disabled={listLoading}
              >
                <RefreshCcw className="h-4 w-4" />
                새로고침
              </Button>
              <Button
                type="button"
                size="sm"
                className="gap-1"
                onClick={handleMarkAll}
                disabled={unreadCount === 0}
              >
                <CheckCheck className="h-4 w-4" />
                모두 읽음
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {listLoading && items.length === 0 ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="space-y-2 rounded-xl border border-slate-100 p-4">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-40" />
                  </div>
                ))}
              </div>
            ) : items.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-muted-foreground">
                표시할 알림이 없습니다. 필터를 바꾸거나 잠시 후 다시 확인해 주세요.
              </div>
            ) : (
              <div className="space-y-3">
                {items.map((notification) => {
                  const meta = resolveNotificationMeta(notification.kindCode)
                  const isUnread = notification.state === "UNREAD"
                  return (
                    <div
                      key={notification.id}
                      className={cn(
                        "space-y-3 rounded-2xl border p-4 shadow-sm transition",
                        isUnread
                          ? "border-emerald-200 bg-emerald-50/60"
                          : "border-slate-200 bg-white hover:border-emerald-200",
                      )}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="border-slate-200 text-slate-700">
                            {meta.label}
                          </Badge>
                          <span className="text-slate-500">{formatRelative(notification.createdAt)}</span>
                        </div>
                        <Badge
                          variant="outline"
                          className={cn(
                            "border-slate-200",
                            isUnread ? "text-emerald-700" : "text-slate-500",
                          )}
                        >
                          {isUnread ? "미읽음" : "읽음"}
                        </Badge>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-slate-900">{notification.title}</p>
                        <p className="text-sm text-slate-600">{notification.body}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
                        <span>받은 시각 {formatDateTime(notification.createdAt)}</span>
                        {notification.readAt && <span>읽은 시각 {formatDateTime(notification.readAt)}</span>}
                        {notification.ttlAt && <span>만료 예정 {formatDateTime(notification.ttlAt)}</span>}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {isUnread && (
                          <Button size="sm" onClick={() => void handleMarkSingle(notification.id)}>
                            읽음 처리
                          </Button>
                        )}
                        {meta.href && (
                          <Button size="sm" variant="outline" asChild>
                            <Link href={meta.href}>관련 화면</Link>
                          </Button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            <div className="flex flex-col gap-3 rounded-xl border border-slate-100 p-3 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
              <span>
                총 {totalElements.toLocaleString()}건 · 페이지 {page + 1}/{totalPages}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange("prev")}
                  disabled={page === 0 || listLoading}
                >
                  이전
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange("next")}
                  disabled={page >= totalPages - 1 || listLoading}
                >
                  다음
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card id="preferences" className="shadow-sm">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base font-semibold">알림 설정</CardTitle>
              <CardDescription>종류별 수신 여부와 백그라운드 푸시 허용을 제어합니다.</CardDescription>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <ShieldAlert className="h-4 w-4" aria-hidden />
              변경 사항은 즉시 적용되며 감사 로그에 기록됩니다.
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {prefLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="space-y-2 rounded-xl border border-slate-100 p-4">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-40" />
                  </div>
                ))}
              </div>
            ) : preferences.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 p-5 text-sm text-muted-foreground">
                표시할 알림 설정이 없습니다.
              </div>
            ) : (
              preferences.map((preference) => {
                const meta = resolveNotificationMeta(preference.kindCode)
                return (
                  <div
                    key={preference.kindCode}
                    className="rounded-2xl border border-slate-200 p-4 shadow-sm"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className="border-slate-200">
                            {meta.label}
                          </Badge>
                          <span className="text-xs text-slate-500">{preference.kindCode}</span>
                        </div>
                        <p className="mt-2 text-sm text-slate-600">
                          {meta.description ?? preference.description}
                        </p>
                        {meta.href ? (
                          <Link
                            href={meta.href}
                            className="mt-1 inline-flex items-center gap-1 text-xs text-emerald-600"
                          >
                            관련 화면 이동
                          </Link>
                        ) : null}
                      </div>
                      <div className="flex flex-col items-end gap-3 text-xs text-slate-500">
                        <div className="flex items-center gap-2">
                          <span>알림 받기</span>
                          <Switch
                            checked={preference.enabled}
                            disabled={prefLoading}
                            onCheckedChange={(checked) =>
                              void handlePreferenceToggle(preference.kindCode, "enabled", Boolean(checked))
                            }
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <span>백그라운드 허용</span>
                          <Switch
                            checked={preference.allowBackground}
                            disabled={prefLoading}
                            onCheckedChange={(checked) =>
                              void handlePreferenceToggle(
                                preference.kindCode,
                                "allowBackground",
                                Boolean(checked),
                              )
                            }
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
            <div className="text-right">
              <Button variant="ghost" size="sm" className="text-xs text-emerald-700" onClick={() => void loadPreferences()}>
                다시 불러오기
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-semibold">푸시 권한 상태</CardTitle>
            <CardDescription>
              브라우저/앱에서 DormMate 알림을 받으려면 권한이 허용되어야 합니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm text-slate-600">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Smartphone className="h-4 w-4" aria-hidden />
              {permissionSupported ? (
                <span>
                  현재 상태:{" "}
                  <strong className="text-slate-900">
                    {permissionStatus === "granted"
                      ? "허용됨"
                      : permissionStatus === "denied"
                        ? "차단됨"
                        : "확인 필요"}
                  </strong>
                </span>
              ) : (
                <span>이 브라우저는 웹 푸시 알림을 지원하지 않습니다.</span>
              )}
            </div>
            {permissionSupported && permissionStatus !== "granted" && (
              <Button
                size="sm"
                variant="outline"
                className="w-fit gap-1"
                onClick={() => void handleRequestPermission()}
              >
                알림 권한 요청
              </Button>
            )}
            <p className="text-xs text-slate-500">
              백그라운드 허용 토글을 켜 두면 DormMate가 서비스 워커를 통해 푸시 알림을 전송할 수 있습니다.
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}

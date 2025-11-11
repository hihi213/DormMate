"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  Bell,
  BellOff,
  BellRing,
  CheckCheck,
  Inbox,
  Loader2,
  RefreshCcw,
  ShieldAlert,
  Sparkles,
} from "lucide-react"
import { format, formatDistanceToNowStrict, parseISO } from "date-fns"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { DangerZoneModal } from "@/components/admin"
import { useToast } from "@/hooks/use-toast"
import { useAdminPolicies } from "@/features/admin/hooks/use-admin-policies"
import {
  useNotificationPreferences,
  useNotifications,
} from "@/features/notifications/hooks/use-notifications"
import { resolveNotificationMeta } from "@/features/notifications/utils/metadata"
import type { NotificationStateFilter } from "@/features/notifications/types"
import { cn } from "@/lib/utils"
import { getDefaultErrorMessage } from "@/lib/api-errors"

const STATE_OPTIONS: Array<{ value: NotificationStateFilter; label: string }> = [
  { value: "all", label: "전체" },
  { value: "unread", label: "미읽음 우선" },
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

export default function AdminNotificationsPage() {
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
  const adminPreferences = useMemo(
    () => preferences.filter((item) => item.kindCode === "FRIDGE_RESULT_ADMIN"),
    [preferences],
  )

  const [batchTime, setBatchTime] = useState("09:00")
  const [dailyLimit, setDailyLimit] = useState("20")
  const [ttlHours, setTtlHours] = useState("24")
  const [penaltyLimit, setPenaltyLimit] = useState("10")
  const [penaltyTemplate, setPenaltyTemplate] = useState(
    "DormMate 벌점 누적 {점수}점으로 세탁실/다목적실/도서관 이용이 7일간 제한됩니다. 냉장고 기능은 유지됩니다.",
  )
  const [autoNotify, setAutoNotify] = useState(true)

  const { data: policies, loading: policyLoading } = useAdminPolicies()

  useEffect(() => {
    void ensureLoaded({ state: filter, page: 0, size })
  }, [ensureLoaded, filter, size])

  useEffect(() => {
    void loadPreferences()
  }, [loadPreferences])

  useEffect(() => {
    if (!policies) return
    setBatchTime(policies.notification.batchTime)
    setDailyLimit(String(policies.notification.dailyLimit))
    setTtlHours(String(policies.notification.ttlHours))
    setPenaltyLimit(String(policies.penalty.limit))
    setPenaltyTemplate(policies.penalty.template)
  }, [policies])

  useEffect(() => {
    if (!listError) return
    toast({
      title: "알림 목록을 불러올 수 없습니다.",
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

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil((totalElements || 0) / Math.max(size, 1))),
    [totalElements, size],
  )

  const handleChangeFilter = (value: string) => {
    const normalized = (value as NotificationStateFilter) ?? "all"
    void setFilter(normalized)
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
      title: "모든 알림이 읽음 처리되었습니다.",
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

  const handleSavePolicy = () => {
    toast({
      title: "알림 정책이 저장되었습니다.",
      description: `배치 시각 ${batchTime}, 상한 ${dailyLimit}건, TTL ${ttlHours}시간`,
    })
  }

  const handleSavePenaltyPolicy = () => {
    toast({
      title: "벌점 정책이 업데이트되었습니다.",
      description: `임계치 ${penaltyLimit}점으로 저장되었습니다.`,
    })
  }

  return (
    <>
      <div data-admin-slot="main" className="space-y-6">
        <header className="rounded-3xl border border-emerald-100 bg-white/95 p-6 shadow-sm">
          <div className="flex flex-col gap-3">
            <Badge
              variant="outline"
              className="w-fit border-emerald-200 bg-emerald-50 text-emerald-700"
            >
              알림 센터
            </Badge>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 space-y-1">
                <h1 className="break-words text-2xl font-semibold text-slate-900">
                  DormMate 알림 관리
                </h1>
                <p className="text-sm text-slate-600">
                  모듈별 알림 현황을 확인하고, 미읽음 처리·알림 설정·배치 정책을 중앙에서 제어합니다.
                </p>
              </div>
              <Badge className="gap-2 bg-emerald-100 text-center text-emerald-700 sm:w-fit">
                <BellRing className="size-4" aria-hidden />
                미확인 {unreadCount}건
              </Badge>
            </div>
          </div>
        </header>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <Card className="shadow-sm">
            <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-base font-semibold text-slate-900">알림 타임라인</CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  모듈별 알림 현황을 확인하고 바로 읽음 처리할 수 있습니다.
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Select value={filter} onValueChange={handleChangeFilter}>
                  <SelectTrigger className="h-8 w-[140px]">
                    <SelectValue placeholder="필터" />
                  </SelectTrigger>
                  <SelectContent>
                    {STATE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="outline" size="sm" className="gap-1" onClick={() => void refresh()}>
                  <RefreshCcw className="size-4" aria-hidden />
                  새로고침
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1"
                  onClick={handleMarkAll}
                  disabled={unreadCount === 0}
                >
                  <CheckCheck className="size-4" aria-hidden />
                  모두 읽음
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="max-h-[520px] pr-4">
                <div className="space-y-3">
                  {listLoading ? (
                    <div className="flex items-center justify-center rounded-lg border border-dashed border-emerald-200 bg-emerald-50/40 py-12 text-sm text-emerald-700">
                      <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                      알림을 불러오는 중입니다…
                    </div>
                  ) : items.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-slate-200 p-6 text-sm text-slate-500">
                      표시할 알림이 없습니다. 필터를 변경하거나 새로고침해 보세요.
                    </div>
                  ) : (
                    items.map((notification) => {
                      const meta = resolveNotificationMeta(notification.kindCode)
                      const isUnread = notification.state === "UNREAD"
                      return (
                        <div
                          key={notification.id}
                          className={cn(
                            "rounded-xl border p-4 shadow-sm transition",
                            isUnread
                              ? "border-emerald-200 bg-emerald-50/70"
                              : "border-slate-200 bg-white hover:border-emerald-200",
                          )}
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="flex items-start gap-3">
                              <span className={cn("rounded-full bg-slate-100 p-2", meta.accentClassName)}>
                                <meta.icon className="size-4" aria-hidden />
                              </span>
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-semibold text-slate-900">{notification.title}</p>
                                  <Badge variant="outline" className="border-slate-200 text-xs">
                                    {meta.label}
                                  </Badge>
                                  <Badge
                                    variant="outline"
                                    className={cn(
                                      "border-slate-200",
                                      isUnread ? "text-emerald-700" : "text-slate-500",
                                    )}
                                  >
                                    {notification.state === "UNREAD" ? "미읽음" : "읽음"}
                                  </Badge>
                                </div>
                                <p className="mt-1 text-sm text-slate-600">{notification.body}</p>
                                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                                  <span>{formatDateTime(notification.createdAt)}</span>
                                  <span>{formatRelative(notification.createdAt)}</span>
                                  {meta.href ? (
                                    <Link
                                      href={meta.href}
                                      className="flex items-center gap-1 text-emerald-600 hover:underline"
                                    >
                                      상세 보기
                                      <Sparkles className="size-3" aria-hidden />
                                    </Link>
                                  ) : null}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {isUnread ? (
                                <Button
                                  size="sm"
                                  onClick={() => void handleMarkSingle(notification.id)}
                                  className="gap-1"
                                >
                                  <CheckCheck className="size-4" aria-hidden />
                                  읽음 처리
                                </Button>
                              ) : (
                                <Badge className="bg-slate-100 text-slate-500">
                                  <BellOff className="mr-1 size-3" aria-hidden />
                                  읽음
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </ScrollArea>
              <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
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

          <div className="space-y-4">
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-base font-semibold text-slate-900">알림 설정</CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  알림 종류별 활성화 여부와 백그라운드 허용을 제어합니다.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {prefLoading ? (
                  <div className="flex items-center justify-center rounded-lg border border-dashed border-slate-200 py-10 text-sm text-slate-500">
                    <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                    알림 설정을 불러오는 중입니다…
                  </div>
                ) : adminPreferences.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-500">
                    표시할 알림 설정이 없습니다.
                  </div>
                ) : (
                  adminPreferences.map((preference) => {
                    const meta = resolveNotificationMeta(preference.kindCode)
                    return (
                      <div key={preference.kindCode} className="rounded-xl border border-slate-200 p-4 shadow-sm">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="border-slate-200">
                                {meta.label}
                              </Badge>
                              <span className="text-xs text-slate-500">{preference.kindCode}</span>
                            </div>
                            <p className="mt-2 text-sm text-slate-600">
                              {meta.description ?? preference.description}
                            </p>
                            {meta.href ? (
                              <Link href={meta.href} className="mt-1 inline-flex items-center gap-1 text-xs text-emerald-600">
                                관련 화면 이동
                              </Link>
                            ) : null}
                          </div>
                          <div className="flex flex-col items-end gap-3">
                            <div className="flex items-center gap-2 text-xs text-slate-500">
                              <span>알림 받기</span>
                              <Switch
                                checked={preference.enabled}
                                onCheckedChange={(checked) =>
                                  void handlePreferenceToggle(preference.kindCode, "enabled", Boolean(checked))
                                }
                              />
                            </div>
                            <div className="flex items-center gap-2 text-xs text-slate-500">
                              <span>백그라운드 허용</span>
                              <Switch
                                checked={preference.allowBackground}
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
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-base font-semibold text-slate-900">배치 알림 정책</CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  임박/만료 배치 스케줄과 dedupe 정책을 조정합니다.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="grid gap-2">
                  <Label className="text-xs text-slate-500">배치 시각</Label>
                  <Select value={batchTime} onValueChange={setBatchTime}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="시간 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="07:30">07:30</SelectItem>
                      <SelectItem value="08:00">08:00</SelectItem>
                      <SelectItem value="09:00">09:00</SelectItem>
                      <SelectItem value="10:00">10:00</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label className="text-xs text-slate-500">하루 발송 상한</Label>
                  <Input
                    value={dailyLimit}
                    onChange={(event) => setDailyLimit(event.target.value)}
                    type="number"
                    min={0}
                    className="w-[140px]"
                  />
                </div>
                <div className="grid gap-2">
                  <Label className="text-xs text-slate-500">TTL (시간)</Label>
                  <Input
                    value={ttlHours}
                    onChange={(event) => setTtlHours(event.target.value)}
                    type="number"
                    min={1}
                    className="w-[140px]"
                  />
                </div>
                <div className="grid gap-2">
                  <Label className="text-xs text-slate-500">테스트 메모</Label>
                  <Textarea rows={3} placeholder="예: 임박 알림 정책 변경 테스트" />
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={autoNotify} onCheckedChange={setAutoNotify} id="auto-notify" />
                  <Label htmlFor="auto-notify" className="text-xs text-slate-500">
                    저장 후 테스트 발송 자동 실행
                  </Label>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleSavePolicy} disabled={policyLoading}>
                    정책 저장
                  </Button>
                  <Button size="sm" variant="outline">
                    Sandbox 미리보기
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-base font-semibold text-slate-900">
                  벌점·제재 알림 정책
                </CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  누적 벌점 임계치와 알림 템플릿을 관리합니다.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="grid gap-2">
                  <Label className="text-xs text-slate-500">누적 벌점 임계치</Label>
                  <Input
                    value={penaltyLimit}
                    onChange={(event) => setPenaltyLimit(event.target.value)}
                    type="number"
                    min={0}
                    className="w-[140px]"
                  />
                </div>
                <div className="grid gap-2">
                  <Label className="text-xs text-slate-500">제재 알림 템플릿</Label>
                  <Textarea
                    rows={4}
                    value={penaltyTemplate}
                    onChange={(event) => setPenaltyTemplate(event.target.value)}
                  />
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleSavePenaltyPolicy}>
                    변경 저장
                  </Button>
                  <Button size="sm" variant="outline">
                    예상 대상 미리보기
                  </Button>
                </div>
                <DangerZoneModal
                  title="벌점 규칙을 초기화하시겠습니까?"
                  description="임계치·알림 템플릿이 기본값으로 되돌아갑니다. 기존 벌점 기록은 유지됩니다."
                  confirmLabel="초기화"
                  onConfirm={async () => undefined}
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <div data-admin-slot="rail" className="space-y-4 text-sm text-slate-600">
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-slate-800">운영 체크리스트</h2>
          <ul className="space-y-2 text-xs leading-relaxed">
            <li className="flex items-start gap-2">
              <BellRing className="mt-0.5 size-4 text-emerald-500" aria-hidden />
              알림을 읽음 처리하면 감사 로그에 `source=admin`으로 기록됩니다.
            </li>
            <li className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 size-4 text-amber-500" aria-hidden />
              임박/만료 알림은 dedupe 키 `{`kind:user:yyyyMMdd`}`로 생성됩니다.
            </li>
            <li className="flex items-start gap-2">
              <ShieldAlert className="mt-0.5 size-4 text-sky-500" aria-hidden />
              정책 수정 후 Sandbox에서 예상 발송 건수를 검증하세요.
            </li>
          </ul>
        </section>
        <Separator />
        <section className="space-y-2 text-xs">
          <h3 className="text-sm font-semibold text-slate-800">빠른 링크</h3>
          <p>
            <Link href="/admin/audit?module=notifications" className="text-emerald-600 hover:underline">
              알림 감사 로그
            </Link>
          </p>
          <p>
            <Link href="/admin/notifications" className="text-emerald-600 hover:underline">
              알림·정책 설정
            </Link>
          </p>
        </section>
      </div>
    </>
  )
}

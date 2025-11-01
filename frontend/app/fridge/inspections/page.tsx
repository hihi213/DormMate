"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { CalendarDays, ClipboardCheck, Loader2, PauseCircle, Play, ShieldCheck } from "lucide-react"

import BottomNav from "@/components/bottom-nav"
import AuthGuard from "@/features/auth/components/auth-guard"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { SlotSelector } from "@/features/fridge/components/slot-selector"
import { useToast } from "@/hooks/use-toast"
import { getCurrentUser } from "@/lib/auth"
import { formatShortDate } from "@/lib/date-utils"
import { formatCompartmentLabel, formatSlotDisplayName } from "@/features/fridge/utils/labels"
import type { Slot } from "@/features/fridge/types"
import type { InspectionAction, InspectionSchedule, InspectionSession } from "@/features/inspections/types"
import {
  cancelInspection,
  fetchActiveInspection,
  fetchInspectionHistory,
  fetchInspectionSlots,
  fetchInspectionSchedules,
  startInspection,
} from "@/features/inspections/api"

const STATUS_BADGE: Record<InspectionSession["status"], { label: string; className: string }> = {
  IN_PROGRESS: {
    label: "진행 중",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  SUBMITTED: {
    label: "완료",
    className: "border-slate-200 bg-slate-50 text-slate-700",
  },
  CANCELED: {
    label: "취소",
    className: "border-rose-200 bg-rose-50 text-rose-700",
  },
}

export default function InspectionsPage() {
  return (
    <AuthGuard>
      <InspectionsInner />
      <BottomNav />
    </AuthGuard>
  )
}

function InspectionsInner() {
  const router = useRouter()
  const { toast } = useToast()
  const [slots, setSlots] = useState<Slot[]>([])
  const [activeSession, setActiveSession] = useState<InspectionSession | null>(null)
  const [history, setHistory] = useState<InspectionSession[]>([])
  const [schedules, setSchedules] = useState<InspectionSchedule[]>([])
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)
  const [canceling, setCanceling] = useState(false)
  const [selectedSlotId, setSelectedSlotId] = useState<string>("")
  const [selectedScheduleId, setSelectedScheduleId] = useState<string>("")
  const [error, setError] = useState<string | null>(null)

  const currentUser = getCurrentUser()
  const canManage = currentUser?.roles.includes("FLOOR_MANAGER") || currentUser?.roles.includes("ADMIN")

  useEffect(() => {
    let canceled = false

    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const slotList = await fetchInspectionSlots()
        const schedulePromise = canManage
          ? fetchInspectionSchedules({ status: "SCHEDULED" })
          : Promise.resolve<InspectionSchedule[]>([])
        const [session, historyList, scheduleList] = await Promise.all([
          fetchActiveInspection(),
          fetchInspectionHistory({ limit: 10 }),
          schedulePromise,
        ])
        if (canceled) return
        const normalizedSlots = canManage
          ? slotList.filter((slot) => slot.resourceStatus === "ACTIVE")
          : slotList
        setSlots(normalizedSlots)
        setActiveSession(session)
        setHistory(historyList)
        if (canManage) {
          setSchedules(scheduleList)
        } else {
          setSchedules([])
        }
      } catch (err) {
        if (canceled) return
        const message = err instanceof Error ? err.message : "검사 정보를 불러오지 못했습니다."
        setError(message)
        toast({
          title: "검사 정보 조회 실패",
          description: message,
          variant: "destructive",
        })
        setSlots([])
        setActiveSession(null)
        setHistory([])
        setSchedules([])
      } finally {
        if (!canceled) {
          setLoading(false)
        }
      }
    }

    void load()

    return () => {
      canceled = true
    }
  }, [canManage, toast])

  const availableSlots = useMemo(() => {
    if (!slots.length) return []
    if (!activeSession) return slots
    return slots.filter((slot) => slot.slotId !== activeSession.slotId)
  }, [slots, activeSession])

  const selectedSlot = availableSlots.find((slot) => slot.slotId === selectedSlotId)

  const availableSchedules = useMemo(
    () => schedules.filter((schedule) => !schedule.inspectionSessionId),
    [schedules],
  )

  useEffect(() => {
    if (selectedScheduleId && !availableSchedules.some((schedule) => schedule.scheduleId === selectedScheduleId)) {
      setSelectedScheduleId("")
    }
  }, [availableSchedules, selectedScheduleId])

  const getSlotLabel = useCallback(
    (slotId?: string, slotIndex?: number) => {
      if (slotId) {
        const slot = slots.find((candidate) => candidate.slotId === slotId)
        if (slot) {
          return formatSlotDisplayName(slot)
        }
      }
      if (typeof slotIndex === "number") {
        return formatCompartmentLabel(slotIndex)
      }
      return "?"
    },
    [slots],
  )

  const handleStartInspection = async () => {
    if (!selectedSlot || starting) return
    try {
      setStarting(true)
      const session = await startInspection({
        slotId: selectedSlot.slotId,
        scheduleId: selectedScheduleId || undefined,
      })
      setSelectedScheduleId("")
      if (canManage) {
        try {
          const refreshedSchedules = await fetchInspectionSchedules({ status: "SCHEDULED" })
          setSchedules(refreshedSchedules)
        } catch (refreshError) {
          console.error("Failed to refresh schedules", refreshError)
        }
      }
      setActiveSession(session)
      toast({
        title: "검사를 시작했습니다.",
        description: `${getSlotLabel(session.slotId, session.slotIndex)} 검사 세션이 생성되었습니다.`,
      })
      router.push(`/fridge/inspect?sessionId=${session.sessionId}`)
    } catch (err) {
      const message = err instanceof Error ? err.message : "검사를 시작하지 못했습니다."
      toast({
        title: "검사 시작 실패",
        description: message,
        variant: "destructive",
      })
    } finally {
      setStarting(false)
    }
  }

  const handleContinue = () => {
    if (!activeSession) return
    router.push(`/fridge/inspect?sessionId=${activeSession.sessionId}`)
  }

  const handleCancel = async () => {
    if (!activeSession || canceling) return
    if (!confirm("진행 중인 검사를 취소할까요? 기록되지 않은 내용은 모두 사라집니다.")) return

    try {
      setCanceling(true)
      await cancelInspection(activeSession.sessionId)
      setActiveSession(null)
      const refreshedHistory = await fetchInspectionHistory({ limit: 10 })
      setHistory(refreshedHistory)
      toast({
        title: "검사 세션이 취소되었습니다.",
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : "검사 취소에 실패했습니다."
      toast({
        title: "검사 취소 실패",
        description: message,
        variant: "destructive",
      })
    } finally {
      setCanceling(false)
    }
  }

  if (!canManage) {
    return (
      <main className="min-h-[100svh] bg-white">
        <header className="sticky top-0 z-40 border-b bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60">
          <div className="mx-auto max-w-screen-sm px-4 py-3 flex items-center justify-between">
            <div className="inline-flex items-center gap-2">
              <CalendarDays className="size-4 text-teal-700" />
              <h1 className="text-base font-semibold leading-none">{"검사 일정"}</h1>
            </div>
            {loading && <Loader2 className="size-4 animate-spin text-emerald-600" aria-hidden />}
          </div>
        </header>

        <div className="mx-auto max-w-screen-sm px-4 pb-28 pt-4 space-y-6">
          {error && (
            <Card className="border-rose-200">
              <CardContent className="py-4 text-sm text-rose-700">{error}</CardContent>
            </Card>
          )}

          <Card className="border-emerald-200">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <ClipboardCheck className="size-4 text-emerald-700" />
                {"검사 진행 현황"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-gray-800">
              {loading ? (
                <p className="text-sm text-muted-foreground">검사 정보를 불러오는 중입니다…</p>
              ) : activeSession ? (
                <>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">
                      {getSlotLabel(activeSession.slotId, activeSession.slotIndex)}
                    </span>
                    <Badge
                      variant="secondary"
                      className={STATUS_BADGE[activeSession.status]?.className}
                    >
                      {STATUS_BADGE[activeSession.status]?.label ?? activeSession.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {`시작: ${formatDateTimeLabel(activeSession.startedAt)}`}
                    {activeSession.endedAt ? ` · 종료: ${formatDateTimeLabel(activeSession.endedAt)}` : ""}
                  </p>
                  {activeSession.summary.length > 0 && (
                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                      {activeSession.summary.map((entry) => (
                        <span key={entry.action} className="inline-flex items-center gap-1 rounded-md border px-2 py-1">
                          {`${friendlyActionLabel(entry.action)} ${entry.count}건`}
                        </span>
                      ))}
                    </div>
                  )}
                  {activeSession.notes && (
                    <p className="text-xs text-slate-600 whitespace-pre-wrap">{activeSession.notes}</p>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">현재 진행 중인 검사가 없습니다.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">{"내 보관 칸"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {slots.length ? (
                <ul className="space-y-2">
                  {slots.map((slot) => {
                    const statusMeta = getSlotStatusMeta(slot)
                    return (
                      <li
                        key={slot.slotId}
                        className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2"
                      >
                        <span className="text-sm font-medium text-gray-900">{formatSlotDisplayName(slot)}</span>
                        <Badge variant="outline" className={statusMeta.className}>
                          {statusMeta.label}
                        </Badge>
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">배정된 냉장고 칸이 없습니다.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">{"검사 이력"}</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-sm text-muted-foreground">검사 이력을 불러오는 중입니다…</p>
              ) : (
                <HistoryList history={history} getSlotLabel={getSlotLabel} />
              )}
            </CardContent>
          </Card>

          <Card className="border-dashed border-emerald-200">
            <CardContent className="flex items-start gap-3 py-4 text-sm text-muted-foreground">
              <ShieldCheck className="mt-0.5 size-4 text-emerald-600" />
              <p>
                {"검사 시작과 조치 기록은 층별장 또는 관리자만 수행할 수 있습니다. 이상이 있다고 판단되면 층별장에게 문의해 주세요."}
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-[100svh] bg-white">
      <header className="sticky top-0 z-40 border-b bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="mx-auto max-w-screen-sm px-4 py-3 flex items-center justify-between">
          <div className="inline-flex items-center gap-2">
            <CalendarDays className="size-4 text-teal-700" />
            <h1 className="text-base font-semibold leading-none">{"냉장고 검사"}</h1>
          </div>
          {loading && <Loader2 className="size-4 animate-spin text-emerald-600" aria-hidden />}
        </div>
      </header>

      <div className="mx-auto max-w-screen-sm px-4 pb-28 pt-4 space-y-6">
        {error && (
          <Card className="border-rose-200">
            <CardContent className="py-4 text-sm text-rose-700">{error}</CardContent>
          </Card>
        )}

        {activeSession ? (
          <Card className="border-emerald-200">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <ClipboardCheck className="size-4 text-emerald-700" />
                {"진행 중인 검사"}
                <Badge
                  variant="secondary"
                  className={`ml-auto ${STATUS_BADGE[activeSession.status]?.className ?? ""}`}
                >
                  {STATUS_BADGE[activeSession.status]?.label ?? activeSession.status}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-sm text-gray-800">
                <p className="font-semibold">{`${getSlotLabel(
                  activeSession.slotId,
                  activeSession.slotIndex,
                )} 검사 세션`}</p>
                <p className="text-xs text-muted-foreground">
                  {`시작: ${formatDateTimeLabel(activeSession.startedAt)}`}
                  {activeSession.endedAt ? ` · 종료: ${formatDateTimeLabel(activeSession.endedAt)}` : ""}
                </p>
                {activeSession.summary.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    {activeSession.summary.map((entry) => (
                      <span key={entry.action} className="inline-flex items-center gap-1 rounded-md border px-2 py-1">
                        {`${friendlyActionLabel(entry.action)} ${entry.count}건`}
                      </span>
                    ))}
                  </div>
                )}
                {activeSession.notes && (
                  <p className="text-xs text-slate-600 whitespace-pre-wrap">{activeSession.notes}</p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={handleContinue}>
                  <Play className="mr-1 size-4" />
                  {"검사 계속"}
                </Button>
                <Button variant="outline" onClick={handleCancel} disabled={canceling}>
                  {canceling ? <Loader2 className="mr-1 size-4 animate-spin" /> : <PauseCircle className="mr-1 size-4" />}
                  {"검사 취소"}
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">{"진행 중인 검사 없음"}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {"현재 진행 중인 검사 세션이 없습니다. 아래에서 검사할 냉장고 칸을 선택해 새 세션을 시작하세요."}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">{"새 검사 시작"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <SlotSelector
              value={selectedSlotId}
              onChange={setSelectedSlotId}
              slots={availableSlots}
              placeholder={availableSlots.length ? "검사할 보관 칸 선택" : "검사 가능한 보관 칸이 없습니다"}
            />
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">연결할 일정 (선택)</p>
              <select
                value={selectedScheduleId}
                onChange={(event) => setSelectedScheduleId(event.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">일정 선택 안 함</option>
                {availableSchedules.map((schedule) => (
                  <option key={schedule.scheduleId} value={schedule.scheduleId}>
                    {`${new Date(schedule.scheduledAt).toLocaleString("ko-KR", {
                      month: "numeric",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}${schedule.title ? ` · ${schedule.title}` : ""}`}
                  </option>
                ))}
              </select>
              {availableSchedules.length === 0 && schedules.length > 0 && (
                <p className="text-[11px] text-muted-foreground">
                  이미 진행 중인 일정은 검사 완료 시 자동으로 정리됩니다.
                </p>
              )}
            </div>
            <Button
              onClick={handleStartInspection}
              disabled={!selectedSlot || starting}
              className="w-full sm:w-auto"
            >
              {starting ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Play className="mr-2 size-4" />}
              {"검사 시작"}
            </Button>
            <p className="text-xs text-muted-foreground">
              {"검사를 완료하면 자동으로 알림과 기록이 생성됩니다."}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">{"검사 이력"}</CardTitle>
          </CardHeader>
          <CardContent>
            {history.length ? (
              <HistoryList history={history} getSlotLabel={getSlotLabel} />
            ) : (
              <p className="text-sm text-muted-foreground">최근 검사 기록이 없습니다.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  )
}

function friendlyActionLabel(action: InspectionAction): string {
  switch (action) {
    case "PASS":
      return "통과"
    case "DISPOSE_EXPIRED":
      return "폐기(유통)"
    case "UNREGISTERED_DISPOSE":
      return "폐기(미등록)"
    case "WARN_STORAGE_POOR":
      return "경고(보관)"
    case "WARN_INFO_MISMATCH":
      return "경고(정보)"
    default:
      return action
  }
}

function HistoryList({
  history,
  getSlotLabel,
}: {
  history: InspectionSession[]
  getSlotLabel: (slotId?: string, slotIndex?: number) => string
}) {
  if (!history.length) {
    return <p className="text-sm text-muted-foreground">최근 검사 기록이 없습니다.</p>
  }

  return (
    <div className="space-y-4">
      {history.map((session) => {
        const badgeMeta = STATUS_BADGE[session.status]
        return (
          <div key={session.sessionId} className="rounded-lg border border-slate-200 p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
              <span>{getSlotLabel(session.slotId, session.slotIndex)}</span>
              <Badge variant="outline" className={badgeMeta?.className ?? ""}>
                {badgeMeta?.label ?? session.status}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {`시작: ${formatDateTimeLabel(session.startedAt)}`}
              {session.endedAt ? ` · 종료: ${formatDateTimeLabel(session.endedAt)}` : ""}
            </p>
            {session.summary.length > 0 && (
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                {session.summary.map((entry) => (
                  <span key={entry.action} className="inline-flex items-center gap-1 rounded-md border px-2 py-1">
                    {`${friendlyActionLabel(entry.action)} ${entry.count}건`}
                  </span>
                ))}
              </div>
            )}
            {session.notes && <p className="text-xs text-slate-600 whitespace-pre-wrap">{session.notes}</p>}
          </div>
        )
      })}
    </div>
  )
}

function getSlotStatusMeta(slot: Slot): { label: string; className: string } {
  if (slot.locked) {
    return {
      label: "검사 중",
      className: "border-amber-200 bg-amber-50 text-amber-700",
    }
  }

  switch (slot.resourceStatus) {
    case "SUSPENDED":
      return {
        label: "점검 중지",
        className: "border-rose-200 bg-rose-50 text-rose-700",
      }
    case "REPORTED":
      return {
        label: "이상 신고",
        className: "border-amber-200 bg-amber-50 text-amber-700",
      }
    case "RETIRED":
      return {
        label: "퇴역",
        className: "border-slate-200 bg-slate-50 text-slate-600",
      }
    default:
      return {
        label: "정상",
        className: "border-emerald-200 bg-emerald-50 text-emerald-700",
      }
  }
}

function formatDateTimeLabel(value?: string | null): string {
  if (!value) return "-"
  const date = new Date(value)
  const dateLabel = formatShortDate(value)
  const timeLabel = date.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })
  return `${dateLabel} ${timeLabel}`
}

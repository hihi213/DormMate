"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { CalendarDays, ClipboardCheck, Loader2, MoreVertical, Play, Plus, ShieldCheck } from "lucide-react"

import BottomNav from "@/components/bottom-nav"
import AuthGuard from "@/features/auth/components/auth-guard"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { SlotSelector } from "@/features/fridge/components/slot-selector"
import { useToast } from "@/hooks/use-toast"
import { getCurrentUser } from "@/lib/auth"
import { formatShortDate } from "@/lib/date-utils"
import { formatCompartmentLabel, formatSlotDisplayName } from "@/features/fridge/utils/labels"
import type { Slot } from "@/features/fridge/types"
import type {
  InspectionAction,
  InspectionSchedule,
  InspectionSession,
  NormalizedInspectionStatus,
} from "@/features/inspections/types"
import { normalizeInspectionStatus } from "@/features/inspections/types"
import {
  cancelInspection,
  createInspectionSchedule,
  fetchActiveInspection,
  fetchInspectionHistory,
  fetchInspectionSlots,
  fetchInspectionSchedules,
  deleteInspectionSchedule,
  startInspection,
  updateInspectionSchedule,
} from "@/features/inspections/api"

const STATUS_BADGE: Record<NormalizedInspectionStatus, { label: string; className: string }> = {
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

const getStatusMeta = (status: InspectionSession["status"]) =>
  STATUS_BADGE[normalizeInspectionStatus(status)]

type ScheduleFormState = {
  scheduledAt: string
  title: string
  notes: string
}

export default function InspectionsPage() {
  if (process.env.NEXT_PUBLIC_FIXTURE === "1") {
    return (
      <>
        <InspectionsInner />
        <BottomNav />
      </>
    )
  }

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
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false)
  const [scheduleDialogMode, setScheduleDialogMode] = useState<"create" | "edit">("create")
  const [scheduleForm, setScheduleForm] = useState<ScheduleFormState>(() => getDefaultScheduleFormState())
  const [scheduleSubmitting, setScheduleSubmitting] = useState(false)
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null)
  const [deleteTargetSchedule, setDeleteTargetSchedule] = useState<InspectionSchedule | null>(null)
  const [deletingSchedule, setDeletingSchedule] = useState(false)
  const [selectedScheduleId, setSelectedScheduleId] = useState<string>("")
  const [startDialogOpen, setStartDialogOpen] = useState(false)
  const [scheduleToStart, setScheduleToStart] = useState<InspectionSchedule | null>(null)
  const [slotToStart, setSlotToStart] = useState<string>("")
  const [scheduleStartingId, setScheduleStartingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)
  const [canceling, setCanceling] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const minScheduleInputValue = useMemo(
    () => formatDateTimeInputValue(new Date()),
    [scheduleDialogOpen],
  )

  const currentUser = getCurrentUser()
  const isFloorManager = currentUser?.roles.includes("FLOOR_MANAGER") ?? false

  const refreshSlotList = useCallback(async () => {
    try {
      const slotList = await fetchInspectionSlots()
      const normalizedSlots = isFloorManager
        ? slotList.filter((slot) => slot.resourceStatus === "ACTIVE")
        : slotList
      setSlots(normalizedSlots)
    } catch (error) {
      console.error("Failed to refresh inspection slots", error)
    }
  }, [isFloorManager])

  const refreshActiveSession = useCallback(async () => {
    try {
      const session = await fetchActiveInspection()
      setActiveSession(session)
      if (!session && activeSession) {
        const refreshedHistory = await fetchInspectionHistory({ limit: 10 })
        setHistory(refreshedHistory)
      }
    } catch (error) {
      console.error("Failed to refresh active inspection", error)
    }
  }, [activeSession])

  const refreshSchedules = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!isFloorManager) return []
      try {
        const data = await fetchInspectionSchedules({ status: "SCHEDULED" })
        setSchedules(data)
        return data
      } catch (err) {
        if (!options?.silent) {
          const message = err instanceof Error ? err.message : "검사 일정을 불러오지 못했습니다."
          toast({
            title: "검사 일정 조회 실패",
            description: message,
            variant: "destructive",
          })
        }
        return []
      }
    },
    [isFloorManager, toast],
  )

  useEffect(() => {
    let canceled = false

    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const slotList = await fetchInspectionSlots()
        const schedulePromise = isFloorManager
          ? fetchInspectionSchedules({ status: "SCHEDULED" })
          : Promise.resolve<InspectionSchedule[]>([])
        const [session, historyList, scheduleList] = await Promise.all([
          fetchActiveInspection(),
          fetchInspectionHistory({ limit: 10 }),
          schedulePromise,
        ])
        if (canceled) return
        const normalizedSlots = isFloorManager
          ? slotList.filter((slot) => slot.resourceStatus === "ACTIVE")
          : slotList
        setSlots(normalizedSlots)
        setActiveSession(session)
        setHistory(historyList)
        if (isFloorManager) {
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
  }, [isFloorManager, toast])

  useEffect(() => {
    if (typeof window === "undefined") return
    const intervalId = window.setInterval(() => {
      void refreshSlotList()
      void refreshActiveSession()
    }, 45000)
    return () => {
      window.clearInterval(intervalId)
    }
  }, [refreshActiveSession, refreshSlotList])

  const availableSlots = useMemo(() => {
    if (!slots.length) return []
    if (!activeSession) return slots
    return slots.filter((slot) => slot.slotId !== activeSession.slotId)
  }, [slots, activeSession])

  const sortedSchedules = useMemo(
    () =>
      schedules
        .slice()
        .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()),
    [schedules],
  )

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

  const handleStartDialogChange = (open: boolean) => {
    if (starting) return
    if (!open) {
      setStartDialogOpen(false)
      setScheduleToStart(null)
      setSlotToStart("")
      setScheduleStartingId(null)
    } else {
      setStartDialogOpen(true)
    }
  }

  const handleRequestStart = (schedule: InspectionSchedule) => {
    if (!isFloorManager) return
    if (activeSession) {
      toast({
        title: "이미 진행 중인 검사가 있습니다.",
        description: "현재 세션을 먼저 제출하거나 취소해 주세요.",
        variant: "destructive",
      })
      return
    }
    setScheduleToStart(schedule)
    const preferredSlotId = schedule.fridgeCompartmentId ?? ""
    const matchedSlot = preferredSlotId
      ? availableSlots.find((candidate) => candidate.slotId === preferredSlotId)
      : undefined
    const fallbackSlot = availableSlots[0]?.slotId ?? ""
    const resolvedSlotId = matchedSlot?.slotId ?? fallbackSlot ?? ""
    if (!resolvedSlotId) {
      toast({
        title: "검사를 시작할 수 없습니다.",
        description: "현재 선택 가능한 칸이 없습니다. 잠시 후 다시 시도해 주세요.",
        variant: "destructive",
      })
      return
    }
    setSlotToStart(resolvedSlotId)
    setScheduleStartingId(null)
    setStartDialogOpen(true)
  }

  const handleConfirmStartInspection = async () => {
    if (!isFloorManager || !scheduleToStart || starting) return
    const slot = availableSlots.find((candidate) => candidate.slotId === slotToStart)
    if (!slot) {
      toast({
        title: "검사를 시작할 수 없습니다.",
        description: "검사 가능한 칸을 선택해 주세요.",
        variant: "destructive",
      })
      return
    }
    try {
      setStarting(true)
      setScheduleStartingId(scheduleToStart.scheduleId)
      const session = await startInspection({
        slotId: slot.slotId,
        scheduleId: scheduleToStart.scheduleId,
      })
      await refreshSchedules({ silent: true })
      await refreshSlotList()
      setActiveSession(session)
      toast({
        title: "검사를 시작했습니다.",
        description: `${getSlotLabel(session.slotId, session.slotIndex)} 검사 세션이 생성되었습니다.`,
      })
      setStartDialogOpen(false)
      setScheduleToStart(null)
      setSlotToStart("")
      setScheduleStartingId(null)
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
      setScheduleStartingId(null)
    }
  }

  const handleContinue = () => {
    if (!isFloorManager || !activeSession) return
    router.push(`/fridge/inspect?sessionId=${activeSession.sessionId}`)
  }

  const handleCancel = async () => {
    if (!isFloorManager || !activeSession || canceling) return
    if (!confirm("진행 중인 검사를 취소할까요? 기록되지 않은 내용은 모두 사라집니다.")) return

    try {
      setCanceling(true)
      await cancelInspection(activeSession.sessionId)
      setActiveSession(null)
      await refreshSchedules({ silent: true })
      const refreshedHistory = await fetchInspectionHistory({ limit: 10 })
      setHistory(refreshedHistory)
      await refreshSlotList()
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

  const handleScheduleDialogChange = (open: boolean) => {
    if (scheduleSubmitting) return
    if (!open) {
      setScheduleDialogOpen(false)
      setEditingScheduleId(null)
      setScheduleForm(getDefaultScheduleFormState())
      return
    }
    if (!isFloorManager) return
    setScheduleDialogOpen(true)
  }

  const handleOpenCreateSchedule = () => {
    if (!isFloorManager) return
    setScheduleDialogMode("create")
    setEditingScheduleId(null)
    setScheduleForm(getDefaultScheduleFormState())
    setScheduleDialogOpen(true)
  }

  const handleEditSchedule = (schedule: InspectionSchedule) => {
    if (!isFloorManager) return
    setScheduleDialogMode("edit")
    setEditingScheduleId(schedule.scheduleId)
    setScheduleForm({
      scheduledAt: formatDateTimeInputValue(new Date(schedule.scheduledAt)),
      title: schedule.title ?? "",
      notes: schedule.notes ?? "",
    })
    setScheduleDialogOpen(true)
  }

  const handleScheduleFieldChange = (field: keyof ScheduleFormState) => (value: string) => {
    setScheduleForm((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const handleSubmitSchedule = async () => {
    if (!isFloorManager) return
    if (!scheduleForm.scheduledAt) {
      toast({
        title: "검사 일정을 저장할 수 없습니다.",
        description: "검사 일시를 선택해 주세요.",
        variant: "destructive",
      })
      return
    }

    const parsed = new Date(scheduleForm.scheduledAt)
    if (Number.isNaN(parsed.getTime())) {
      toast({
        title: "검사 일정을 저장할 수 없습니다.",
        description: "검사 일시 형식이 올바르지 않습니다.",
        variant: "destructive",
      })
      return
    }
    const now = new Date()
    if (parsed.getTime() < now.getTime()) {
      toast({
        title: "검사 일정을 저장할 수 없습니다.",
        description: "현재 이후의 일시를 선택해 주세요.",
        variant: "destructive",
      })
      return
    }

    const title = scheduleForm.title.trim()
    const notes = scheduleForm.notes.trim()

    try {
      setScheduleSubmitting(true)
      if (scheduleDialogMode === "create") {
        await createInspectionSchedule({
          scheduledAt: parsed.toISOString(),
          title: title.length ? title : undefined,
          notes: notes.length ? notes : undefined,
        })
        toast({
          title: "검사 일정을 추가했습니다.",
        })
      } else if (editingScheduleId) {
        await updateInspectionSchedule(editingScheduleId, {
          scheduledAt: parsed.toISOString(),
          title: title.length ? title : null,
          notes: notes.length ? notes : null,
        })
        toast({
          title: "검사 일정을 수정했습니다.",
        })
      } else {
        throw new Error("수정할 검사 일정을 찾지 못했습니다.")
      }
      await refreshSchedules({ silent: true })
      setScheduleDialogOpen(false)
      setEditingScheduleId(null)
      setScheduleForm(getDefaultScheduleFormState())
    } catch (err) {
      const message = err instanceof Error ? err.message : "검사 일정을 저장하지 못했습니다."
      toast({
        title: "검사 일정 저장 실패",
        description: message,
        variant: "destructive",
      })
    } finally {
      setScheduleSubmitting(false)
    }
  }

  const handleDeleteScheduleRequest = (schedule: InspectionSchedule) => {
    if (!isFloorManager) return
    setDeleteTargetSchedule(schedule)
    setSelectedScheduleId(schedule.scheduleId)
  }

  const handleDeleteDialogChange = (open: boolean) => {
    if (deletingSchedule) return
    if (!open) {
      setDeleteTargetSchedule(null)
      setSelectedScheduleId("")
    }
  }

  const handleConfirmDeleteSchedule = async () => {
    if (!deleteTargetSchedule) return
    try {
      setDeletingSchedule(true)
      const targetId = deleteTargetSchedule.scheduleId
      await deleteInspectionSchedule(targetId)
      setSchedules((prev) => prev.filter((schedule) => schedule.scheduleId !== targetId))
      toast({
        title: "검사 일정을 삭제했습니다.",
      })
      if (selectedScheduleId === deleteTargetSchedule.scheduleId) {
        setSelectedScheduleId("")
      }
      await refreshSchedules({ silent: true })
      setDeleteTargetSchedule(null)
    } catch (err) {
      const message = err instanceof Error ? err.message : "검사 일정을 삭제하지 못했습니다."
      toast({
        title: "검사 일정 삭제 실패",
        description: message,
        variant: "destructive",
      })
    } finally {
      setDeletingSchedule(false)
    }
  }

  const activeSessionBadge = activeSession ? getStatusMeta(activeSession.status) : null

  if (!isFloorManager) {
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
                      className={activeSessionBadge?.className}
                    >
                      {activeSessionBadge?.label ?? activeSession.status}
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
                {"검사 시작과 조치 기록은 층별장만 수행할 수 있습니다. 이상이 있다고 판단되면 담당 층별장에게 문의해 주세요."}
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

      <div className="mx-auto max-w-screen-sm px-4 pb-28 pt-4 space-y-8">
        {error && (
          <Card className="border-rose-200">
            <CardContent className="py-4 text-sm text-rose-700">{error}</CardContent>
          </Card>
        )}

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="inline-flex items-center gap-2">
              <ClipboardCheck className="size-4 text-emerald-700" />
              <h2 className="text-sm font-semibold">{"검사 일정"}</h2>
            </div>
            {isFloorManager && (
              <Button size="sm" onClick={handleOpenCreateSchedule}>
                <Plus className="mr-1 size-4" />
                {"일정 추가"}
              </Button>
            )}
          </div>

          <Card>
            <CardContent className="space-y-3">
              {loading ? (
                <p className="text-sm text-muted-foreground">검사 일정을 불러오는 중입니다…</p>
              ) : sortedSchedules.length === 0 ? (
                <p className="text-sm text-muted-foreground">등록된 검사 일정이 없습니다.</p>
              ) : (
                <ul className="space-y-3">
                  {sortedSchedules.map((schedule) => {
                    const isActiveSchedule =
                      Boolean(activeSession && schedule.inspectionSessionId === activeSession.sessionId)
                    const primaryDisabled =
                      !isFloorManager ||
                      (isActiveSchedule
                        ? false
                        : starting || availableSlots.length === 0 || Boolean(activeSession))
                    const hasSlotInfo =
                      Boolean(schedule.fridgeCompartmentId) || typeof schedule.slotIndex === "number"
                    const slotLabelCandidate = hasSlotInfo
                      ? getSlotLabel(schedule.fridgeCompartmentId ?? undefined, schedule.slotIndex ?? undefined)
                      : null
                    const slotDisplayLabel =
                      slotLabelCandidate && slotLabelCandidate !== "?"
                        ? slotLabelCandidate
                        : hasSlotInfo
                          ? "칸 정보 없음"
                          : "검사 시작 시 칸 선택"
                    const scheduleStatusBadge = isActiveSchedule
                      ? { className: "border-emerald-300 bg-emerald-100 text-emerald-700", label: "진행 중" }
                      : { className: "border-slate-200 bg-slate-50 text-slate-600", label: "예정" }
                    const slotLabelForCard = slotDisplayLabel ?? "검사 시작 시 칸 선택"

                    return (
                      <li key={schedule.scheduleId} className="rounded-lg border border-slate-200 p-4 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                            <span>{slotLabelForCard}</span>
                            <Badge variant="outline" className={scheduleStatusBadge.className}>
                              {scheduleStatusBadge.label}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2">
                            {isFloorManager ? (
                              <Button
                                size="sm"
                                className="px-3"
                                onClick={() =>
                                  isActiveSchedule ? handleContinue() : handleRequestStart(schedule)
                                }
                                disabled={primaryDisabled}
                                variant={isActiveSchedule ? "secondary" : "default"}
                              >
                                {scheduleStartingId === schedule.scheduleId && starting && !isActiveSchedule ? (
                                  <>
                                    <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                                    {"검사 시작"}
                                  </>
                                ) : isActiveSchedule ? (
                                  <>
                                    <ShieldCheck className="mr-2 size-4" aria-hidden />
                                    {"검사 중"}
                                  </>
                                ) : (
                                  <>
                                    <Play className="mr-2 size-4" aria-hidden />
                                    {"검사 시작"}
                                  </>
                                )}
                              </Button>
                            ) : (
                              <Badge variant="outline" className="border-slate-200 text-slate-600">
                                {isActiveSchedule ? "진행 중" : "층별장 전용"}
                              </Badge>
                            )}
                            {isFloorManager && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                                    <MoreVertical className="size-4" aria-hidden />
                                    <span className="sr-only">{"일정 옵션"}</span>
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onSelect={(event) => {
                                  event.preventDefault()
                                  handleEditSchedule(schedule)
                                }}
                              >
                                {"일정 수정"}
                              </DropdownMenuItem>
                              {isActiveSchedule && (
                                <DropdownMenuItem
                                  className="text-amber-600 focus:text-amber-600"
                                  onSelect={(event) => {
                                    event.preventDefault()
                                    if (!canceling) {
                                      void handleCancel()
                                    }
                                  }}
                                >
                                  {canceling ? "취소 중..." : "검사 취소"}
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem
                                className="text-rose-600 focus:text-rose-600"
                                onSelect={(event) => {
                                  event.preventDefault()
                                  handleDeleteScheduleRequest(schedule)
                                    }}
                                  >
                                    {"일정 삭제"}
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <p>{formatDateTimeLabel(schedule.scheduledAt)}</p>
                        </div>
                        <p className="text-sm font-medium text-gray-900">{getScheduleTitleText(schedule)}</p>
                        {schedule.notes && (
                          <p className="text-xs text-muted-foreground whitespace-pre-wrap">{schedule.notes}</p>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}
            </CardContent>
          </Card>

        </section>

        <section className="space-y-4">
          <div className="inline-flex items-center gap-2">
            <CalendarDays className="size-4 text-emerald-700" />
            <h2 className="text-sm font-semibold">{"검사 기록"}</h2>
          </div>
          <Card>
            <CardContent>
              {history.length ? (
                <HistoryList history={history} getSlotLabel={getSlotLabel} />
              ) : loading ? (
                <p className="text-sm text-muted-foreground">검사 기록을 불러오는 중입니다…</p>
              ) : (
                <p className="text-sm text-muted-foreground">최근 검사 기록이 없습니다.</p>
              )}
            </CardContent>
          </Card>
        </section>

        <Dialog open={startDialogOpen} onOpenChange={handleStartDialogChange}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{"검사 시작"}</DialogTitle>
              <DialogDescription>
                {scheduleToStart
                  ? `${formatShortDate(scheduleToStart.scheduledAt)} 검사 일정을 기반으로 새 검사 세션을 시작합니다.`
                  : "검사 일정을 선택해 세션을 시작할 수 있습니다."}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
                <span className="block font-semibold text-slate-900">
                  {scheduleToStart ? getScheduleTitleText(scheduleToStart) : "선택된 일정 없음"}
                </span>
                {scheduleToStart && (
                  <span>
                    {new Date(scheduleToStart.scheduledAt).toLocaleString("ko-KR", {
                      month: "numeric",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                )}
                {scheduleToStart?.notes && <span className="whitespace-pre-wrap">{scheduleToStart.notes}</span>}
              </div>
              <div className="space-y-2">
                <Label>{"검사할 칸 선택"}</Label>
                {availableSlots.length > 0 ? (
                  <SlotSelector
                    value={slotToStart}
                    onChange={setSlotToStart}
                    slots={availableSlots}
                    placeholder="검사할 보관 칸 선택"
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {"검사 가능한 칸이 없습니다. 다른 사용자의 검사가 끝난 뒤 다시 시도해 주세요."}
                  </p>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleStartDialogChange(false)}
                disabled={starting}
              >
                {"취소"}
              </Button>
              <Button
                type="button"
                onClick={handleConfirmStartInspection}
                disabled={starting || !scheduleToStart || !slotToStart || availableSlots.length === 0}
              >
                {starting ? <Loader2 className="mr-2 size-4 animate-spin" aria-hidden /> : <Play className="mr-2 size-4" aria-hidden />}
                {"검사 시작"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={scheduleDialogOpen} onOpenChange={handleScheduleDialogChange}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {scheduleDialogMode === "create" ? "검사 일정 추가" : "검사 일정 수정"}
              </DialogTitle>
              <DialogDescription>
                {"층별장과 관리자 화면에서 공유되는 검사 일정을 등록하거나 수정할 수 있습니다."}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="inspection-schedule-datetime">{"검사 일시"}</Label>
                <Input
                  id="inspection-schedule-datetime"
                  type="datetime-local"
                  value={scheduleForm.scheduledAt}
                  onChange={(event) => handleScheduleFieldChange("scheduledAt")(event.target.value)}
                  disabled={scheduleSubmitting}
                  min={minScheduleInputValue}
                />
                <p className="text-xs text-muted-foreground">
                  {"오늘 이후 시각만 선택할 수 있습니다."}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="inspection-schedule-title">{"제목"}</Label>
                <Input
                  id="inspection-schedule-title"
                  value={scheduleForm.title}
                  onChange={(event) => handleScheduleFieldChange("title")(event.target.value)}
                  placeholder="예: 3층 냉장고 정기 점검"
                  disabled={scheduleSubmitting}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="inspection-schedule-notes">{"메모"}</Label>
                <Textarea
                  id="inspection-schedule-notes"
                  value={scheduleForm.notes}
                  onChange={(event) => handleScheduleFieldChange("notes")(event.target.value)}
                  placeholder="필요 시 세부 지시사항을 남겨 주세요."
                  rows={4}
                  disabled={scheduleSubmitting}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleScheduleDialogChange(false)}
                disabled={scheduleSubmitting}
              >
                {"취소"}
              </Button>
              <Button type="button" onClick={handleSubmitSchedule} disabled={scheduleSubmitting}>
                {scheduleSubmitting && <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />}
                {"저장"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog
          open={Boolean(deleteTargetSchedule)}
          onOpenChange={handleDeleteDialogChange}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{"검사 일정을 삭제할까요?"}</AlertDialogTitle>
              <AlertDialogDescription>
                {deleteTargetSchedule
                  ? `${getScheduleDisplayName(deleteTargetSchedule)} 일정을 삭제하면 연결된 세션 링크가 해제됩니다.`
                  : "선택한 검사 일정을 삭제하면 되돌릴 수 없습니다."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deletingSchedule}>{"취소"}</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirmDeleteSchedule} disabled={deletingSchedule}>
                {deletingSchedule && <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />}
                {"삭제"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </main>
  )
}

function getScheduleTitleText(schedule: InspectionSchedule): string {
  const trimmed = schedule.title?.trim()
  if (trimmed && trimmed.length > 0) {
    return trimmed
  }
  return ""
}

function getScheduleDisplayName(schedule: InspectionSchedule): string {
  return `"${getScheduleTitleText(schedule)}"`
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
        const badgeMeta = getStatusMeta(session.status)
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

function formatDateTimeInputValue(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  const hours = String(date.getHours()).padStart(2, "0")
  const minutes = String(date.getMinutes()).padStart(2, "0")
  return `${year}-${month}-${day}T${hours}:${minutes}`
}

function getDefaultScheduleFormState(): ScheduleFormState {
  const baseline = new Date()
  baseline.setSeconds(0, 0)
  return {
    scheduledAt: formatDateTimeInputValue(baseline),
    title: "",
    notes: "",
  }
}

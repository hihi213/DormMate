"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import dynamic from "next/dynamic"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { CalendarDays, ClipboardCheck, Loader2, MoreVertical, Play, Plus, ShieldCheck } from "lucide-react"

import BottomNav from "@/components/bottom-nav"
import AuthGuard from "@/features/auth/components/auth-guard"
import UserServiceHeader from "@/app/_components/home/user-service-header"
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
import { useLogoutRedirect } from "@/hooks/use-logout-redirect"
import { getCurrentUser } from "@/lib/auth"
import { formatShortDate } from "@/lib/date-utils"
import { formatCompartmentLabel, formatSlotDisplayName } from "@/features/fridge/utils/labels"
import type { Slot } from "@/features/fridge/types"
import type {
  InspectionAction,
  InspectionActionDetail,
  InspectionSchedule,
  InspectionSession,
  NormalizedInspectionStatus,
} from "@/features/inspections/types"
import { normalizeInspectionStatus } from "@/features/inspections/types"
import {
  cancelInspection,
  createInspectionSchedule,
  fetchActiveInspection,
  fetchInspection,
  fetchInspectionHistory,
  fetchInspectionSlots,
  fetchInspectionSchedules,
  deleteInspectionSchedule,
  startInspection,
  updateInspectionSchedule,
} from "@/features/inspections/api"

const BundleDetailSheet = dynamic(() => import("@/features/fridge/components/bundle-detail-sheet"), { ssr: false })

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

const RESIDENT_WARNING_ACTIONS: InspectionAction[] = ["WARN_INFO_MISMATCH", "WARN_STORAGE_POOR"]
const RESIDENT_DISPOSAL_ACTIONS: InspectionAction[] = ["DISPOSE_EXPIRED", "UNREGISTERED_DISPOSE"]

const RESIDENT_ACTION_TYPES: InspectionAction[] = [
  ...RESIDENT_WARNING_ACTIONS,
  ...RESIDENT_DISPOSAL_ACTIONS,
]

const isResidentActionType = (action: InspectionAction) => RESIDENT_ACTION_TYPES.includes(action)
const isWarningAction = (action: InspectionAction) => RESIDENT_WARNING_ACTIONS.includes(action)
const isDisposalAction = (action: InspectionAction) => RESIDENT_DISPOSAL_ACTIONS.includes(action)

type ScheduleFormState = {
  scheduledAt: string
  notes: string
}

type ScheduleGroup = {
  groupId: string
  scheduledAt: string
  notes?: string | null
  schedules: InspectionSchedule[]
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
  const logoutAndRedirect = useLogoutRedirect()
  const [slots, setSlots] = useState<Slot[]>([])
  const [activeSession, setActiveSession] = useState<InspectionSession | null>(null)
  const [history, setHistory] = useState<InspectionSession[]>([])
  const [schedules, setSchedules] = useState<InspectionSchedule[]>([])
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false)
  const [scheduleDialogMode, setScheduleDialogMode] = useState<"create" | "edit">("create")
  const [scheduleForm, setScheduleForm] = useState<ScheduleFormState>(() => getDefaultScheduleFormState())
  const [scheduleSubmitting, setScheduleSubmitting] = useState(false)
  const [editingGroup, setEditingGroup] = useState<ScheduleGroup | null>(null)
  const [deleteTargetGroup, setDeleteTargetGroup] = useState<ScheduleGroup | null>(null)
  const [deletingSchedule, setDeletingSchedule] = useState(false)
  const [startDialogOpen, setStartDialogOpen] = useState(false)
  const [groupToStart, setGroupToStart] = useState<ScheduleGroup | null>(null)
  const [slotToStart, setSlotToStart] = useState<string>("")
  const [startingGroupId, setStartingGroupId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)
  const [canceling, setCanceling] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [residentActionDialog, setResidentActionDialog] = useState<{
    session: InspectionSession
    actions: InspectionActionDetail[]
  } | null>(null)
  const [residentActionLoadingId, setResidentActionLoadingId] = useState<string | null>(null)
  const [focusedAction, setFocusedAction] = useState<InspectionActionDetail | null>(null)
  const [bundleSheet, setBundleSheet] = useState<{ open: boolean; id: string; unitId?: string | null }>({
    open: false,
    id: "",
    unitId: null,
  })
  const minScheduleInputValue = useMemo(() => formatDateTimeInputValue(new Date()), [])

  const currentUser = getCurrentUser()
  const isAdmin = currentUser?.roles.includes("ADMIN") ?? false
  const isFloorManager = currentUser?.roles.includes("FLOOR_MANAGER") ?? false
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])

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
    [toast],
  )

  const handleHistorySelect = useCallback(
    async (session: InspectionSession) => {
      if (!currentUser?.userId) return
      setResidentActionLoadingId(session.sessionId)
      try {
        let detail = session
        if (!detail.actions || detail.actions.length === 0) {
          detail = await fetchInspection(session.sessionId)
        }
        const personalActions =
          detail.actions?.filter(
            (action) => action.targetUserId === currentUser.userId && isResidentActionType(action.actionType),
          ) ?? []

        if (!personalActions.length) {
          toast({
            title: "조치 없음",
            description: "해당 검사에서 본인에게 내려진 경고나 폐기 기록이 없습니다.",
          })
          return
        }

        setResidentActionDialog({ session: detail, actions: personalActions })
      } catch (error) {
        toast({
          title: "조치 타임라인을 불러오지 못했습니다.",
          description: error instanceof Error ? error.message : "조치 정보를 확인하는 중 문제가 발생했습니다.",
          variant: "destructive",
        })
      } finally {
        setResidentActionLoadingId(null)
      }
    },
    [currentUser?.userId, toast],
  )

  const handleInspectActionDetail = useCallback(
    (action: InspectionActionDetail) => {
      if (isWarningAction(action.actionType)) {
        const targetItem = action.items?.find((item) => item.fridgeItemId)
        if (targetItem?.fridgeItemId && action.bundleId) {
          setBundleSheet({ open: true, id: action.bundleId, unitId: targetItem.fridgeItemId })
          return
        }
        if (action.bundleId) {
          setBundleSheet({ open: true, id: action.bundleId })
          return
        }
      }
      if (isDisposalAction(action.actionType)) {
        setFocusedAction(action)
        return
      }
      toast({
        title: "조치 정보를 열 수 없습니다",
        description: "연결된 물품 정보를 찾지 못했습니다. 잠시 후 다시 시도해 주세요.",
        variant: "destructive",
      })
    },
    [toast],
  )

  useEffect(() => {
    let canceled = false

    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const slotList = await fetchInspectionSlots()
        const schedulePromise = fetchInspectionSchedules({ status: "SCHEDULED" }).catch((err) => {
          if (isFloorManager) {
            throw err
          }
          console.warn("Failed to load schedules (resident view)", err)
          return []
        })
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
        setSchedules(scheduleList)
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
    if (typeof window === "undefined" || !mounted) return
    const POLLING_INTERVAL_MS = 6000
    const tick = () => {
      void Promise.allSettled([
        refreshSlotList(),
        refreshActiveSession(),
        refreshSchedules({ silent: true }),
      ])
    }
    const intervalId = window.setInterval(tick, POLLING_INTERVAL_MS)
    return () => {
      window.clearInterval(intervalId)
    }
  }, [mounted, refreshActiveSession, refreshSchedules, refreshSlotList])

  const scheduleGroups = useMemo(() => groupSchedules(schedules), [schedules])
  const groupStartSlots = useMemo(
    () => (groupToStart ? getGroupSlots(groupToStart, slots) : []),
    [groupToStart, slots],
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
      setGroupToStart(null)
      setSlotToStart("")
      setStartingGroupId(null)
    } else {
      setStartDialogOpen(true)
    }
  }

  const handleRequestStart = (group: ScheduleGroup) => {
    if (!isFloorManager) return
    if (activeSession) {
      toast({
        title: "이미 진행 중인 검사가 있습니다.",
        description: "현재 세션을 먼저 제출하거나 취소해 주세요.",
        variant: "destructive",
      })
      return
    }
    const groupSlots = getGroupSlots(group, slots)
    const selectableSlot = groupSlots.find((slot) => isSlotSelectableForStart(slot, activeSession))
    if (!selectableSlot) {
      toast({
        title: "검사를 시작할 수 없습니다.",
        description: "현재 선택 가능한 칸이 없습니다. 잠시 후 다시 시도해 주세요.",
        variant: "destructive",
      })
      return
    }
    setGroupToStart(group)
    setSlotToStart(selectableSlot.slotId)
    setStartingGroupId(null)
    setStartDialogOpen(true)
  }

  const handleConfirmStartInspection = async () => {
    if (!isFloorManager || !groupToStart || starting) return
    const slot = slots.find((candidate) => candidate.slotId === slotToStart)
    if (!slot) {
      toast({
        title: "검사를 시작할 수 없습니다.",
        description: "검사 가능한 칸을 선택해 주세요.",
        variant: "destructive",
      })
      return
    }
    const targetSchedule =
      groupToStart.schedules.find((schedule) => schedule.fridgeCompartmentId === slot.slotId) ??
      groupToStart.schedules.find(
        (schedule) =>
          typeof schedule.slotIndex === "number" && typeof slot.slotIndex === "number"
            ? schedule.slotIndex === slot.slotIndex
            : false,
      )
    if (!targetSchedule) {
      toast({
        title: "검사를 시작할 수 없습니다.",
        description: "선택한 칸과 연결된 일정 정보를 찾을 수 없습니다.",
        variant: "destructive",
      })
      return
    }
    try {
      setStarting(true)
      setStartingGroupId(groupToStart.groupId)
      const session = await startInspection({
        slotId: slot.slotId,
        scheduleId: targetSchedule.scheduleId,
      })
      await refreshSchedules({ silent: true })
      await refreshSlotList()
      setActiveSession(session)
      toast({
        title: "검사를 시작했습니다.",
        description: `${getSlotLabel(session.slotId, session.slotIndex)} 검사 세션이 생성되었습니다.`,
      })
      setStartDialogOpen(false)
      setGroupToStart(null)
      setSlotToStart("")
      setStartingGroupId(null)
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
      setStartingGroupId(null)
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
      setEditingGroup(null)
      setScheduleForm(getDefaultScheduleFormState())
      return
    }
    if (!isFloorManager) return
    setScheduleDialogOpen(true)
  }

  const handleOpenCreateSchedule = () => {
    if (!isFloorManager) return
    if (!slots.length) {
      toast({
        title: "일정을 추가할 수 없습니다.",
        description: "검사할 수 있는 냉장고 칸이 없습니다. 잠시 후 다시 시도해 주세요.",
        variant: "destructive",
      })
      return
    }
    setScheduleDialogMode("create")
    setEditingGroup(null)
    setScheduleForm(getDefaultScheduleFormState())
    setScheduleDialogOpen(true)
  }

  const handleEditGroup = (group: ScheduleGroup) => {
    if (!isFloorManager) return
    setScheduleDialogMode("edit")
    setEditingGroup(group)
    setScheduleForm({
      scheduledAt: formatDateTimeInputValue(new Date(group.scheduledAt)),
      notes: group.notes ?? "",
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

    const notes = scheduleForm.notes.trim()

    try {
      setScheduleSubmitting(true)
      if (scheduleDialogMode === "create") {
        if (!slots.length) {
          throw new Error("검사 가능한 칸이 없습니다.")
        }
        const results = await Promise.allSettled(
          slots.map((slot) =>
            createInspectionSchedule({
              scheduledAt: parsed.toISOString(),
              notes: notes.length ? notes : undefined,
              fridgeCompartmentId: slot.slotId,
            }),
          ),
        )
        const successCount = results.filter((result) => result.status === "fulfilled").length
        const failureCount = results.length - successCount
        if (successCount === 0) {
          throw new Error("모든 칸에 대한 일정 생성에 실패했습니다.")
        }
        toast({
          title: "검사 일정을 추가했습니다.",
          description:
            failureCount > 0
              ? `${successCount}개 칸은 저장됐지만 ${failureCount}개 칸은 실패했습니다.`
              : undefined,
        })
      } else if (editingGroup) {
        const updates = await Promise.allSettled(
          editingGroup.schedules.map((schedule) =>
            updateInspectionSchedule(schedule.scheduleId, {
              scheduledAt: parsed.toISOString(),
              notes: notes.length ? notes : null,
            }),
          ),
        )
        const successCount = updates.filter((result) => result.status === "fulfilled").length
        const failureCount = updates.length - successCount
        if (successCount === 0) {
          throw new Error("일정을 수정하지 못했습니다.")
        }
        toast({
          title: "검사 일정을 수정했습니다.",
          description:
            failureCount > 0
              ? `${successCount}개 칸은 수정됐지만 ${failureCount}개 칸은 실패했습니다.`
              : undefined,
        })
      } else {
        throw new Error("수정할 검사 일정을 찾지 못했습니다.")
      }
      await refreshSchedules({ silent: true })
      setScheduleDialogOpen(false)
      setEditingGroup(null)
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

  const handleDeleteGroupRequest = (group: ScheduleGroup) => {
    if (!isFloorManager) return
    setDeleteTargetGroup(group)
  }

  const handleDeleteDialogChange = (open: boolean) => {
    if (deletingSchedule) return
    if (!open) {
      setDeleteTargetGroup(null)
    }
  }

  const handleConfirmDeleteGroup = async () => {
    if (!deleteTargetGroup) return
    try {
      setDeletingSchedule(true)
      const deletions = await Promise.allSettled(
        deleteTargetGroup.schedules.map((schedule) => deleteInspectionSchedule(schedule.scheduleId)),
      )
      const successCount = deletions.filter((result) => result.status === "fulfilled").length
      if (successCount === 0) {
        throw new Error("일정을 삭제하지 못했습니다.")
      }
      toast({
        title: "검사 일정을 삭제했습니다.",
        description:
          successCount < deleteTargetGroup.schedules.length
            ? `${successCount}개 칸만 삭제되었습니다.`
            : undefined,
      })
      await refreshSchedules({ silent: true })
      setDeleteTargetGroup(null)
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

  const residentNotice = !isFloorManager ? (
    <Card className="border-dashed border-emerald-200">
      <CardContent className="flex items-start gap-3 py-4 text-sm text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-4 text-emerald-600" />
        <p>
          {"검사 시작과 조치 기록은 층별장만 수행할 수 있습니다. 이상이 있다고 판단되면 담당 층별장에게 문의해 주세요."}
        </p>
      </CardContent>
    </Card>
  ) : null

  const inspectionsContext = useMemo(
    () => (
      <div className="inline-flex items-center gap-2 text-emerald-700">
        <CalendarDays className="h-5 w-5" aria-hidden />
        <span className="text-base font-semibold leading-none">{"검사 일정"}</span>
        {loading && <Loader2 className="size-4 animate-spin text-emerald-600" aria-hidden />}
      </div>
    ),
    [loading],
  )

  return (
    <main className="min-h-[100svh] bg-white">
      <UserServiceHeader
        service="fridge"
        mounted={mounted}
        user={currentUser}
        isAdmin={isAdmin}
        onOpenInfo={() => toast({ title: "내 정보 화면은 아직 준비 중입니다." })}
        onLogout={() => {
          void logoutAndRedirect()
        }}
        contextSlotOverride={inspectionsContext}
      />

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
              ) : scheduleGroups.length === 0 ? (
                <p className="text-sm text-muted-foreground">등록된 검사 일정이 없습니다.</p>
              ) : (
                <ul className="space-y-3">
                  {scheduleGroups.map((group) => {
                    const groupSlots = getGroupSlots(group, slots)
                    const groupSlotSummary = formatGroupSlotSummary(groupSlots)
                    const isGroupActive = Boolean(
                      activeSession &&
                        group.schedules.some(
                          (schedule) => schedule.inspectionSessionId === activeSession.sessionId,
                        ),
                    )
                    const hasSelectableSlot = groupSlots.some((slot) =>
                      isSlotSelectableForStart(slot, activeSession),
                    )
                    const primaryDisabled =
                      !isFloorManager ||
                      (isGroupActive ? false : starting || !hasSelectableSlot || Boolean(activeSession))
                    const statusBadge = isGroupActive
                      ? { className: "border-emerald-300 bg-emerald-50 text-emerald-700", label: "검사 중" }
                      : { className: "border-slate-200 bg-slate-50 text-slate-600", label: "예정" }
                    return (
                      <li key={group.groupId} className="rounded-lg border border-slate-200 p-4 space-y-3">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 space-y-1">
                            <p className="text-xs text-muted-foreground">
                              {formatDateTimeLabel(group.scheduledAt)}
                            </p>
                            <Badge variant="outline" className={statusBadge.className}>
                              {statusBadge.label}
                            </Badge>
                            <p className="text-sm font-semibold text-gray-900">
                              {group.notes?.trim() ? group.notes : "메모 없음"}
                            </p>
                            <p className="text-xs text-muted-foreground">{groupSlotSummary}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            {isFloorManager ? (
                              <Button
                                size="sm"
                                className="px-3"
                                onClick={() =>
                                  isGroupActive ? handleContinue() : handleRequestStart(group)
                                }
                                disabled={primaryDisabled}
                                variant={isGroupActive ? "secondary" : "default"}
                              >
                                {startingGroupId === group.groupId && starting && !isGroupActive ? (
                                  <>
                                    <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                                    {"검사 시작"}
                                  </>
                                ) : isGroupActive ? (
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
                            ) : null}
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
                                      handleEditGroup(group)
                                    }}
                                  >
                                    {"일정 수정"}
                                  </DropdownMenuItem>
                                  {isGroupActive && (
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
                                      handleDeleteGroupRequest(group)
                                    }}
                                  >
                                    {"일정 삭제"}
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </div>
                        </div>
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
                <HistoryList
                  history={history}
                  getSlotLabel={getSlotLabel}
                  onSelect={handleHistorySelect}
                  pendingSessionId={residentActionLoadingId}
                />
              ) : loading ? (
                <p className="text-sm text-muted-foreground">검사 기록을 불러오는 중입니다…</p>
              ) : (
                <p className="text-sm text-muted-foreground">최근 검사 기록이 없습니다.</p>
              )}
            </CardContent>
          </Card>
        </section>

        {residentNotice}

        <BundleDetailSheet
          open={bundleSheet.open}
          onOpenChange={(open) =>
            setBundleSheet((prev) => ({ ...prev, open, unitId: open ? prev.unitId : null }))
          }
          bundleId={bundleSheet.id}
          initialEdit={false}
          initialUnitId={bundleSheet.unitId ?? null}
        />

        <Dialog
          open={Boolean(residentActionDialog)}
          onOpenChange={(open) => {
            if (!open) {
              setResidentActionDialog(null)
              setFocusedAction(null)
            }
          }}
        >
          <DialogContent className="max-w-xl">
            {residentActionDialog ? (
              <>
                <DialogHeader>
                  <DialogTitle>{"내 경고·폐기 타임라인"}</DialogTitle>
                  <DialogDescription>
                    {`${getSlotLabel(
                      residentActionDialog.session.slotId,
                      residentActionDialog.session.slotIndex,
                    )} · ${formatDateTimeLabel(residentActionDialog.session.startedAt)}`}
                  </DialogDescription>
                </DialogHeader>
                <ResidentActionTimeline
                  detail={residentActionDialog}
                  onSelectAction={(action) => {
                    handleInspectActionDetail(action)
                  }}
                />
                <DialogFooter className="pt-2">
                  <Button type="button" variant="outline" onClick={() => setResidentActionDialog(null)}>
                    {"닫기"}
                  </Button>
                </DialogFooter>
              </>
            ) : null}
          </DialogContent>
        </Dialog>

        <Dialog
          open={Boolean(focusedAction)}
          onOpenChange={(open) => {
            if (!open) {
              setFocusedAction(null)
            }
          }}
        >
          <DialogContent className="max-w-lg">
            {focusedAction ? (
              <>
                <DialogHeader>
                  <DialogTitle>{friendlyActionLabel(focusedAction.actionType)}</DialogTitle>
                  <DialogDescription>{formatDateTimeLabel(focusedAction.recordedAt)}</DialogDescription>
                </DialogHeader>
                <ResidentActionDetail action={focusedAction} />
                <DialogFooter className="pt-2">
                  <Button type="button" variant="outline" onClick={() => setFocusedAction(null)}>
                    {"닫기"}
                  </Button>
                </DialogFooter>
              </>
            ) : null}
          </DialogContent>
        </Dialog>

        <Dialog open={startDialogOpen} onOpenChange={handleStartDialogChange}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{"검사 시작"}</DialogTitle>
              <DialogDescription>
                {groupToStart
                  ? `${formatShortDate(groupToStart.scheduledAt)} 검사 일정을 기반으로 새 검사 세션을 시작합니다.`
                  : "검사 일정을 선택해 세션을 시작할 수 있습니다."}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
                <span className="block font-semibold text-slate-900">
                  {groupToStart ? formatDateTimeLabel(groupToStart.scheduledAt) : "선택된 일정 없음"}
                </span>
                {groupToStart?.notes && <span className="whitespace-pre-wrap">{groupToStart.notes}</span>}
              </div>
              <div className="space-y-2">
                <Label>{"검사할 칸 선택"}</Label>
                {groupStartSlots.length > 0 ? (
                  <SlotSelector
                    value={slotToStart}
                    onChange={setSlotToStart}
                    slots={groupStartSlots}
                    placeholder="검사할 보관 칸 선택"
                    isSelectable={(slot) => isSlotSelectableForStart(slot, activeSession)}
                    getDisabledDescription={(slot) =>
                      !isSlotSelectableForStart(slot, activeSession)
                        ? "현재 선택할 수 없는 칸입니다."
                        : undefined
                    }
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {"선택 가능한 칸이 없습니다. 다른 사용자의 검사가 끝난 뒤 다시 시도해 주세요."}
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
                disabled={starting || !groupToStart || !slotToStart || groupStartSlots.length === 0}
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

        <AlertDialog open={Boolean(deleteTargetGroup)} onOpenChange={handleDeleteDialogChange}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{"검사 일정을 삭제할까요?"}</AlertDialogTitle>
              <AlertDialogDescription>
                {deleteTargetGroup
                  ? `${getGroupDisplayName(deleteTargetGroup)} · ${deleteTargetGroup.schedules.length}개 칸 일정을 모두 삭제합니다.`
                  : "선택한 검사 일정을 삭제하면 되돌릴 수 없습니다."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deletingSchedule}>{"취소"}</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirmDeleteGroup} disabled={deletingSchedule}>
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

function getGroupDisplayName(group: ScheduleGroup): string {
  const memo = group.notes?.trim()
  return memo && memo.length > 0 ? `${formatDateTimeLabel(group.scheduledAt)} · ${memo}` : formatDateTimeLabel(group.scheduledAt)
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
  onSelect,
  pendingSessionId,
}: {
  history: InspectionSession[]
  getSlotLabel: (slotId?: string, slotIndex?: number) => string
  onSelect?: (session: InspectionSession) => void
  pendingSessionId?: string | null
}) {
  if (!history.length) {
    return <p className="text-sm text-muted-foreground">최근 검사 기록이 없습니다.</p>
  }

  return (
    <div className="space-y-4">
      {history.map((session) => {
        const badgeMeta = getStatusMeta(session.status)
        const content = (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
              <span>{getSlotLabel(session.slotId, session.slotIndex)}</span>
              <Badge variant="outline" className={badgeMeta?.className ?? ""}>
                {badgeMeta?.label ?? session.status}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {`검사일 ${formatShortDate(session.startedAt)}`}
              {session.endedAt ? ` · 종료 ${formatShortDate(session.endedAt)}` : ""}
            </p>
            {session.summary.length > 0 && (
              <div className="space-y-1 text-xs text-muted-foreground">
                {session.summary.map((entry) => (
                  <div
                    key={entry.action}
                    className="flex items-center justify-between rounded-md border border-slate-100 bg-slate-50/80 px-2 py-1"
                  >
                    <span className="font-medium text-slate-600">{friendlyActionLabel(entry.action)}</span>
                    <span className="min-w-[48px] text-right font-semibold tabular-nums text-slate-900">
                      {entry.count}건
                    </span>
                  </div>
                ))}
              </div>
            )}
            {session.notes && <p className="text-xs text-slate-600 whitespace-pre-wrap">{session.notes}</p>}
          </div>
        )

        if (!onSelect) {
          return (
            <div key={session.sessionId} className="rounded-lg border border-slate-200 p-4">
              {content}
            </div>
          )
        }

        const pending = pendingSessionId === session.sessionId

        return (
          <button
            key={session.sessionId}
            type="button"
            onClick={() => onSelect(session)}
            disabled={pending}
            className="relative w-full rounded-lg border border-slate-200 bg-white p-4 text-left transition hover:border-emerald-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:cursor-wait disabled:opacity-75"
            aria-label="검사 기록 상세 보기"
          >
            {content}
            <span className="mt-2 block text-[11px] text-emerald-700">
              {"내 경고·폐기 기록 보기"}
            </span>
            {pending ? (
              <Loader2 className="absolute right-4 top-4 size-4 animate-spin text-emerald-600" aria-hidden />
            ) : null}
          </button>
        )
      })}
    </div>
  )
}

type ResidentActionDialogState = {
  session: InspectionSession
  actions: InspectionActionDetail[]
}

function ResidentActionTimeline({
  detail,
  onSelectAction,
}: {
  detail: ResidentActionDialogState
  onSelectAction?: (action: InspectionActionDetail) => void
}) {
  const warningCount = detail.actions.filter((action) => isWarningAction(action.actionType)).length
  const disposalCount = detail.actions.filter((action) => isDisposalAction(action.actionType)).length

  return (
    <div className="space-y-4 text-xs text-slate-600">
      <div className="flex flex-wrap gap-2">
        {warningCount > 0 ? (
          <Badge className="bg-amber-100 px-3 py-0.5 text-[11px] font-semibold text-amber-800">
            {`경고 ${warningCount}`}
          </Badge>
        ) : null}
        {disposalCount > 0 ? (
          <Badge className="bg-rose-100 px-3 py-0.5 text-[11px] font-semibold text-rose-700">
            {`폐기 ${disposalCount}`}
          </Badge>
        ) : null}
      </div>
      <div className="max-h-[340px] space-y-2 overflow-y-auto pr-1">
        {detail.actions.map((action, index) => {
          const key = action.actionId ?? action.correlationId ?? `${action.recordedAt ?? "action"}-${index}`
          const note = action.note?.trim()
          const badgeClass = isDisposalAction(action.actionType)
            ? "border-rose-200 bg-rose-50 text-rose-700"
            : "border-amber-200 bg-amber-50 text-amber-700"
          const itemCount = action.items?.length ?? 0
          const penaltyCount = action.penalties?.length ?? 0

          return (
            <button
              type="button"
              key={key}
              onClick={() => onSelectAction?.(action)}
              className="w-full rounded-md border border-slate-200 bg-white p-3 text-left transition hover:border-emerald-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold text-slate-800">
                <Badge
                  variant="outline"
                  className={`px-2 py-0.5 text-[11px] font-semibold ${badgeClass}`}
                >
                  {friendlyActionLabel(action.actionType)}
                </Badge>
                <span className="text-slate-500">{formatDateTimeLabel(action.recordedAt)}</span>
                {itemCount > 0 ? <span className="text-slate-500">{`물품 ${itemCount}개`}</span> : null}
                {penaltyCount > 0 ? (
                  <span className="text-amber-700">{`벌점 ${penaltyCount}건`}</span>
                ) : null}
              </div>

              {action.items && action.items.length > 0 ? (
                <ul className="mt-2 space-y-1 text-[11px] text-slate-600">
                  {action.items.map((item) => (
                    <li key={item.id} className="rounded-md bg-slate-50 px-2 py-1 leading-snug">
                      {formatResidentActionItem(item)}
                    </li>
                  ))}
                </ul>
              ) : null}

              {action.penalties && action.penalties.length > 0 ? (
                <div className="mt-2 space-y-1 rounded-md border border-amber-100 bg-amber-50/60 px-2 py-1 text-amber-800">
                  {action.penalties.map((penalty) => (
                    <p key={penalty.id}>
                      {`벌점 ${penalty.points}점`}
                      {penalty.expiresAt ? ` · 만료 ${formatShortDate(penalty.expiresAt)}` : ""}
                    </p>
                  ))}
                </div>
              ) : null}

              {note ? <p className="mt-2 text-[11px] text-slate-500">“{note}”</p> : null}
              <span className="mt-2 block text-[11px] font-medium text-emerald-700">{"자세히 보기"}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function ResidentActionDetail({ action }: { action: InspectionActionDetail }) {
  const note = action.note?.trim()
  const isDisposal = isDisposalAction(action.actionType)

  return (
    <div className="space-y-4 text-xs text-slate-600">
      <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant="outline"
            className={`px-2 py-0.5 text-[11px] font-semibold ${
              isDisposal ? "border-rose-200 bg-rose-50 text-rose-700" : "border-amber-200 bg-amber-50 text-amber-700"
            }`}
          >
            {friendlyActionLabel(action.actionType)}
          </Badge>
          <span className="text-slate-500">{formatDateTimeLabel(action.recordedAt)}</span>
          {action.items?.length ? <span>{`물품 ${action.items.length}개`}</span> : null}
          {action.penalties?.length ? <span className="text-amber-700">{`벌점 ${action.penalties.length}건`}</span> : null}
        </div>
      </div>

      {action.items && action.items.length > 0 ? (
        <section className="space-y-2">
          <h3 className="text-[11px] font-semibold text-slate-800">{"기록된 물품"}</h3>
          <div className="space-y-2">
            {action.items.map((item) => (
              <div key={item.id} className="rounded-md border border-slate-200 bg-white px-3 py-2">
                <p className="font-medium text-slate-900">{item.snapshotName ?? "이름 미상"}</p>
                <p className="text-[11px] text-slate-600">{formatResidentActionItem(item)}</p>
                {item.snapshotExpiresOn ? (
                  <p className="text-[11px] text-slate-500">{`유통기한: ${formatShortDate(item.snapshotExpiresOn)}`}</p>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {action.penalties && action.penalties.length > 0 ? (
        <section className="space-y-2">
          <h3 className="text-[11px] font-semibold text-slate-800">{"벌점 내역"}</h3>
          <div className="space-y-2">
            {action.penalties.map((penalty) => (
              <div key={penalty.id} className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900">
                <p className="font-semibold">{`벌점 ${penalty.points}점`}</p>
                {penalty.reason ? <p className="text-[11px]">{penalty.reason}</p> : null}
                <p className="text-[11px] opacity-80">
                  {`발급 ${formatDateTimeLabel(penalty.issuedAt)}${
                    penalty.expiresAt ? ` · 만료 ${formatDateTimeLabel(penalty.expiresAt)}` : ""
                  }`}
                </p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {note ? (
        <section className="space-y-2">
          <h3 className="text-[11px] font-semibold text-slate-800">{"메모"}</h3>
          <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
            {note}
          </p>
        </section>
      ) : null}
    </div>
  )
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

function formatResidentActionItem(
  item: NonNullable<InspectionActionDetail["items"]>[number],
): string {
  const parts: string[] = []
  if (item.snapshotName) {
    parts.push(item.snapshotName)
  }
  if (item.quantityAtAction && item.quantityAtAction > 0) {
    parts.push(`${item.quantityAtAction}개`)
  }
  if (item.snapshotExpiresOn) {
    parts.push(`유통 ${formatShortDate(item.snapshotExpiresOn)}`)
  }
  return parts.length > 0 ? parts.join(" · ") : "기록된 물품"
}

function getDefaultScheduleFormState(): ScheduleFormState {
  const baseline = new Date()
  baseline.setSeconds(0, 0)
  return {
    scheduledAt: formatDateTimeInputValue(baseline),
    notes: "",
  }
}

function groupSchedules(list: InspectionSchedule[]): ScheduleGroup[] {
  const grouped = new Map<string, ScheduleGroup>()
  list.forEach((schedule) => {
    const key = `${schedule.scheduledAt}::${(schedule.notes ?? "").trim()}`
    if (!grouped.has(key)) {
      grouped.set(key, {
        groupId: key,
        scheduledAt: schedule.scheduledAt,
        notes: schedule.notes,
        schedules: [],
      })
    }
    grouped.get(key)!.schedules.push(schedule)
  })
  return Array.from(grouped.values()).sort(
    (a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime(),
  )
}

function getGroupSlots(group: ScheduleGroup, slots: Slot[]): Slot[] {
  const unique = new Map<string, Slot>()
  group.schedules.forEach((schedule) => {
    let slot =
      slots.find((candidate) => candidate.slotId === schedule.fridgeCompartmentId) ??
      slots.find(
        (candidate) =>
          typeof schedule.slotIndex === "number" &&
          candidate.slotIndex === schedule.slotIndex &&
          (typeof schedule.floorNo === "number" ? candidate.floorNo === schedule.floorNo : true),
      ) ??
      slots.find(
        (candidate) =>
          !!schedule.slotLetter &&
          candidate.slotLetter === schedule.slotLetter &&
          (typeof schedule.floorNo === "number" ? candidate.floorNo === schedule.floorNo : true),
      )
    if (slot) {
      unique.set(slot.slotId, slot)
    }
  })
  return Array.from(unique.values()).sort((a, b) => a.slotIndex - b.slotIndex)
}

function formatGroupSlotSummary(slots: Slot[]): string {
  if (!slots.length) return "연결된 칸 정보 없음"
  const labels = slots.map((slot) => formatSlotDisplayName(slot))
  if (labels.length <= 2) {
    return labels.join(", ")
  }
  return `${labels.slice(0, 2).join(", ")} 외 ${labels.length - 2}칸`
}

function isSlotSelectableForStart(slot: Slot, activeSession: InspectionSession | null): boolean {
  if (slot.locked) return false
  if (slot.resourceStatus !== "ACTIVE") return false
  if (activeSession && activeSession.slotId === slot.slotId) return false
  return true
}

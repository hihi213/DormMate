"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react"
import { ClipboardCheck, ListChecks, ShieldCheck, Loader2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { SlotSelector } from "@/features/fridge/components/slot-selector"
import {
  fetchFridgeSlots,
  updateFridgeCompartment,
} from "@/features/fridge/api"
import type {
  ResourceStatus,
  Slot,
  UpdateCompartmentConfigPayload,
} from "@/features/fridge/types"
import { formatSlotDisplayName } from "@/features/fridge/utils/labels"
import {
  deleteInspectionSchedule,
  fetchInspectionHistory,
  fetchInspectionSchedules,
  updateInspectionSchedule,
} from "@/features/inspections/api"
import type {
  InspectionAction,
  InspectionSchedule,
  InspectionSession,
} from "@/features/inspections/types"
import { getCurrentUser, subscribeAuth, type AuthUser } from "@/lib/auth"

const ROLE_LABEL = {
  ADMIN: "관리자",
  FLOOR_MANAGER: "층별장",
} as const

const ACTION_LABEL: Record<InspectionAction, string> = {
  WARN_INFO_MISMATCH: "정보 불일치 경고",
  WARN_STORAGE_POOR: "보관 불량 경고",
  DISPOSE_EXPIRED: "폐기 조치",
  PASS: "이상 없음",
  UNREGISTERED_DISPOSE: "미등록 폐기",
}

type AdminFridgeToolsProps = {
  onRequestResidentView?: () => void
}

type RecentHistoryEntry = {
  id: string
  occurredAt?: string | null
  notes?: string
  passed: number
  warned: number
  discarded: number
  actions: NonNullable<InspectionSession["actions"]>
  penaltyPoints: number
}

export function AdminFridgeTools({ onRequestResidentView }: AdminFridgeToolsProps) {
  const isMountedRef = useRef(true)
  const [authUser, setAuthUser] = useState<AuthUser | null>(getCurrentUser())
  const [slots, setSlots] = useState<Slot[]>([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [selectedSlotId, setSelectedSlotId] = useState<string>("")
  const [formState, setFormState] = useState<{ maxBundleCount: string; status: ResourceStatus }>({
    maxBundleCount: "",
    status: "ACTIVE",
  })
  const [savingSlot, setSavingSlot] = useState(false)
  const [schedules, setSchedules] = useState<InspectionSchedule[]>([])
  const [history, setHistory] = useState<InspectionSession[]>([])
  const [inspectionDataLoading, setInspectionDataLoading] = useState(false)
  const [scheduleActionId, setScheduleActionId] = useState<string | null>(null)
  const [scheduleDeleteId, setScheduleDeleteId] = useState<string | null>(null)
  const { toast } = useToast()

  const isFloorManager = authUser?.roles.includes("FLOOR_MANAGER") ?? false

  useEffect(() => {
    return () => {
      isMountedRef.current = false
    }
  }, [])

  useEffect(() => {
    const unsubscribe = subscribeAuth(setAuthUser)
    return () => unsubscribe()
  }, [])

  const reloadInspectionMeta = useCallback(
    async (options?: { silent?: boolean }) => {
      setInspectionDataLoading(true)
      try {
        const [scheduleData, historyData] = await Promise.all([
          fetchInspectionSchedules(),
          fetchInspectionHistory({ status: "SUBMITTED", limit: 10 }),
        ])
        if (!isMountedRef.current) return
        setSchedules(scheduleData)
        setHistory(historyData)
      } catch (error) {
        if (!isMountedRef.current) return
        console.error("Failed to load inspection meta", error)
        if (!options?.silent) {
          toast({
            title: "검사 정보를 불러오지 못했습니다.",
            description: "네트워크 상태를 확인한 뒤 다시 시도해 주세요.",
            variant: "destructive",
          })
        }
      } finally {
        if (isMountedRef.current) {
          setInspectionDataLoading(false)
        }
      }
    },
    [toast],
  )

  useEffect(() => {
    void reloadInspectionMeta({ silent: true })
  }, [reloadInspectionMeta])

  useEffect(() => {
    let cancelled = false
    const loadSlots = async () => {
      try {
        setSlotsLoading(true)
        const data = await fetchFridgeSlots()
        if (cancelled) return
        setSlots(data)
        if (!selectedSlotId && data.length > 0) {
          setSelectedSlotId(data[0].slotId)
        }
      } catch (error) {
        if (cancelled) return
        console.error("Failed to load compartments", error)
        toast({
          title: "칸 정보를 불러오지 못했습니다.",
          description: "네트워크 상태를 확인한 뒤 다시 시도해 주세요.",
          variant: "destructive",
        })
      } finally {
        if (!cancelled) {
          setSlotsLoading(false)
        }
      }
    }

    void loadSlots()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSlotId])

  useEffect(() => {
    if (!selectedSlotId) return
    const slot = slots.find((candidate) => candidate.slotId === selectedSlotId)
    if (!slot) return
    setFormState({
      maxBundleCount: slot.capacity != null ? String(slot.capacity) : "",
      status: slot.resourceStatus,
    })
  }, [selectedSlotId, slots])

  const upcomingSchedules = useMemo(() => {
    return schedules
      .filter((entry) => entry.status === "SCHEDULED")
      .slice()
      .sort(
        (a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime(),
      )
  }, [schedules])

  const recentHistory = useMemo<RecentHistoryEntry[]>(() => {
    const toMillis = (value?: string | null) => (value ? new Date(value).getTime() : 0)
    return history
      .slice()
      .sort((a, b) => {
        const endA = a.endedAt ?? a.startedAt
        const endB = b.endedAt ?? b.startedAt
        return toMillis(endB) - toMillis(endA)
      })
      .slice(0, 3)
      .map((session) => {
        const occurredAt = session.endedAt ?? session.startedAt
        const counts = session.summary.reduce(
          (acc, entry) => {
            if (entry.action === "PASS") acc.passed += entry.count
            else if (entry.action.startsWith("WARN")) acc.warned += entry.count
            else if (entry.action.startsWith("DISPOSE") || entry.action === "UNREGISTERED_DISPOSE") acc.discarded += entry.count
            return acc
          },
          { passed: 0, warned: 0, discarded: 0 },
        )
        const actionDetails = session.actions ?? []
        const penaltyPoints = actionDetails
          .flatMap((action) => action.penalties ?? [])
          .reduce((total, penalty) => total + penalty.points, 0)
        return {
          id: session.sessionId,
          occurredAt,
          notes: session.notes ?? undefined,
          ...counts,
          actions: actionDetails,
          penaltyPoints,
        }
      })
  }, [history])

  const handleSlotChange = useCallback((slotId: string) => {
    setSelectedSlotId(slotId)
  }, [])

  const handleCapacityChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const numericOnly = event.target.value.replace(/[^0-9]/g, "")
    setFormState((prev) => ({ ...prev, maxBundleCount: numericOnly }))
  }, [])

  const handleStatusChange = useCallback((event: ChangeEvent<HTMLSelectElement>) => {
    setFormState((prev) => ({ ...prev, status: event.target.value as ResourceStatus }))
  }, [])

  const statusOptions: ResourceStatus[] = ["ACTIVE", "SUSPENDED", "REPORTED", "RETIRED"]
  const statusLabel = useCallback((status: ResourceStatus) => {
    switch (status) {
      case "ACTIVE":
        return "사용 가능"
      case "SUSPENDED":
        return "점검 중"
      case "REPORTED":
        return "이상 신고"
      case "RETIRED":
        return "퇴역"
      default:
        return status
    }
  }, [])

  const selectedSlot = useMemo(
    () => slots.find((slot) => slot.slotId === selectedSlotId) ?? null,
    [slots, selectedSlotId],
  )

  const handleCompartmentSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      if (!selectedSlotId) {
        toast({
          title: "칸을 선택해 주세요.",
          variant: "destructive",
        })
        return
      }

      const payload: UpdateCompartmentConfigPayload = {}
      if (formState.maxBundleCount.trim().length > 0) {
        const parsed = Number(formState.maxBundleCount)
        if (!Number.isFinite(parsed) || parsed <= 0) {
          toast({
            title: "허용량을 확인해 주세요.",
            description: "허용량은 1 이상의 숫자여야 합니다.",
            variant: "destructive",
          })
          return
        }
        payload.maxBundleCount = Math.floor(parsed)
      }
      payload.status = formState.status

      try {
        setSavingSlot(true)
        const updated = await updateFridgeCompartment(selectedSlotId, payload)
        setSlots((prev) => prev.map((slot) => (slot.slotId === updated.slotId ? updated : slot)))
        toast({
          title: "저장되었습니다",
          description: `${formatSlotDisplayName(updated)} 설정이 갱신되었습니다.`,
        })
      } catch (error) {
        toast({
          title: "저장 실패",
          description:
            error instanceof Error
              ? error.message
              : "칸 설정을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.",
          variant: "destructive",
        })
      } finally {
        setSavingSlot(false)
      }
    },
    [selectedSlotId, formState.maxBundleCount, formState.status, toast],
  )

  const handleCompleteSchedule = useCallback(
    async (scheduleId: string) => {
      if (!isFloorManager) {
        toast({
          title: "완료 처리는 층별장 권한입니다.",
          description: "층별장에게 요청하거나 권한을 조정해 주세요.",
        })
        return
      }
      try {
        setScheduleActionId(scheduleId)
        await updateInspectionSchedule(scheduleId, { status: "COMPLETED" })
        if (!isMountedRef.current) return
        toast({
          title: "일정을 완료 처리했습니다.",
        })
        await reloadInspectionMeta()
      } catch (error) {
        if (!isMountedRef.current) return
        console.error("Failed to complete inspection schedule", error)
        toast({
          title: "완료 처리에 실패했습니다.",
          description: error instanceof Error ? error.message : "다시 시도해 주세요.",
          variant: "destructive",
        })
      } finally {
        if (isMountedRef.current) {
          setScheduleActionId(null)
        }
      }
    },
    [reloadInspectionMeta, toast, isFloorManager],
  )

  const handleDeleteSchedule = useCallback(
    async (scheduleId: string) => {
      if (!isFloorManager) {
        toast({
          title: "검사 일정 삭제 권한이 없습니다.",
          description: "층별장에게 삭제를 요청해 주세요.",
        })
        return
      }
      if (!confirm("해당 검사를 삭제할까요?")) return
      try {
        setScheduleDeleteId(scheduleId)
        await deleteInspectionSchedule(scheduleId)
        if (!isMountedRef.current) return
        toast({
          title: "검사 일정을 삭제했습니다.",
        })
        await reloadInspectionMeta()
      } catch (error) {
        if (!isMountedRef.current) return
        console.error("Failed to delete inspection schedule", error)
        toast({
          title: "삭제에 실패했습니다.",
          description: error instanceof Error ? error.message : "다시 시도해 주세요.",
          variant: "destructive",
        })
      } finally {
        if (isMountedRef.current) {
          setScheduleDeleteId(null)
        }
      }
    },
    [reloadInspectionMeta, toast, isFloorManager],
  )

  return (
    <main className="min-h-[100svh] bg-white pb-28">
      <header className="sticky top-0 z-40 border-b bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="mx-auto flex max-w-screen-sm items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-700" />
            <div>
              <p className="text-sm font-medium text-gray-700">냉장고 관리자 도구</p>
              <p className="text-xs text-muted-foreground">
                {authUser?.name} · {ROLE_LABEL.ADMIN}
                {authUser?.isFloorManager && ` · ${ROLE_LABEL.FLOOR_MANAGER}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onRequestResidentView && (
              <Button variant="outline" size="sm" onClick={onRequestResidentView}>
                거주자 보기
              </Button>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-screen-sm flex-col gap-6 px-4 py-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              냉장고 자원 관리
            </CardTitle>
          </CardHeader>
          <CardContent>
            {slotsLoading ? (
              <p className="text-sm text-muted-foreground">칸 정보를 불러오는 중입니다…</p>
            ) : slots.length === 0 ? (
              <p className="text-sm text-muted-foreground">등록된 냉장고 칸이 없습니다.</p>
            ) : (
              <form onSubmit={handleCompartmentSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">보관 칸</Label>
                  <SlotSelector
                    value={selectedSlotId}
                    onChange={handleSlotChange}
                    slots={slots}
                    placeholder="칸을 선택하세요"
                    className="w-full"
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">허용 포장 수</Label>
                    <Input
                      value={formState.maxBundleCount}
                      onChange={handleCapacityChange}
                      inputMode="numeric"
                      pattern="[0-9]*"
                      placeholder={selectedSlot?.capacity != null ? String(selectedSlot.capacity) : "예: 12"}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">상태</Label>
                    <select
                      value={formState.status}
                      onChange={handleStatusChange}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      {statusOptions.map((option) => (
                        <option key={option} value={option}>
                          {statusLabel(option)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                {selectedSlot && (
                  <p className="text-xs text-muted-foreground">
                    {`현재 상태: ${statusLabel(selectedSlot.resourceStatus)} · 허용 포장 수: ${
                      selectedSlot.capacity != null ? selectedSlot.capacity : "제한 없음"
                    }`}
                  </p>
                )}
                <div className="flex justify-end">
                  <Button type="submit" disabled={savingSlot || !selectedSlotId}>
                    {savingSlot && <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />}
                    저장
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <ClipboardCheck className="h-4 w-4 text-emerald-700" />
              예정된 검사
              <Badge variant="secondary" className="ml-auto">
                {upcomingSchedules.length}건
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {inspectionDataLoading ? (
              <p className="text-sm text-muted-foreground">검사 일정을 불러오는 중입니다…</p>
            ) : upcomingSchedules.length === 0 ? (
              <p className="text-sm text-muted-foreground">예정된 검사가 없습니다.</p>
            ) : (
              <ul className="space-y-2">
                {upcomingSchedules.map((entry) => {
                  const completing = scheduleActionId === entry.scheduleId
                  const deleting = scheduleDeleteId === entry.scheduleId
                  return (
                    <li key={entry.scheduleId} className="rounded-md border px-3 py-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 space-y-1">
                          <div className="text-sm font-medium text-gray-900">{entry.title ?? "검사"}</div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(entry.scheduledAt).toLocaleString("ko-KR", {
                              month: "numeric",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </div>
                          {entry.notes && <div className="text-xs text-muted-foreground">{entry.notes}</div>}
                          {entry.inspectionSessionId && (
                            <div className="text-[11px] text-emerald-600">
                              연결된 세션 · <span className="font-mono">{entry.inspectionSessionId.slice(0, 8)}…</span>
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleCompleteSchedule(entry.scheduleId)}
                            disabled={!isFloorManager || completing || deleting}
                          >
                            {completing && <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />}
                            완료 처리
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-rose-200 text-rose-600 hover:bg-rose-50"
                            onClick={() => handleDeleteSchedule(entry.scheduleId)}
                            disabled={!isFloorManager || deleting || completing}
                          >
                            {deleting && <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />}
                            삭제
                          </Button>
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <ListChecks className="h-4 w-4 text-emerald-700" />
              최근 검사 결과
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {inspectionDataLoading ? (
              <p className="text-sm text-muted-foreground">검사 결과를 불러오는 중입니다…</p>
            ) : recentHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground">최근 제출된 검사 결과가 없습니다.</p>
            ) : (
              <ul className="space-y-2">
                {recentHistory.map((entry) => {
                  const formattedTime = entry.occurredAt
                    ? new Date(entry.occurredAt).toLocaleString("ko-KR", {
                        month: "numeric",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "-"
                  return (
                    <li key={entry.id} className="flex flex-col gap-2 rounded-md border px-3 py-2">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="flex min-w-0 flex-1 flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-900">{formattedTime}</span>
                            {entry.penaltyPoints > 0 && (
                              <Badge variant="outline" className="border-rose-200 text-rose-700">
                                벌점 총 {entry.penaltyPoints}점
                              </Badge>
                            )}
                          </div>
                          {entry.notes && <div className="text-xs text-muted-foreground">{entry.notes}</div>}
                          {entry.actions.length > 0 && (
                            <div className="mt-1 flex flex-col gap-1 text-xs text-muted-foreground">
                              {entry.actions.slice(0, 3).map((action) => {
                                const penaltySum = (action.penalties ?? []).reduce((sum, penalty) => sum + penalty.points, 0)
                                return (
                                  <div key={`${action.actionId}-${action.recordedAt}`} className="flex flex-wrap items-center gap-2">
                                    <span className="font-medium text-gray-800">{ACTION_LABEL[action.actionType]}</span>
                                    {action.note && <span className="truncate text-gray-600">{action.note}</span>}
                                    {penaltySum > 0 && <span className="text-rose-600">벌점 {penaltySum}점</span>}
                                  </div>
                                )
                              })}
                              {entry.actions.length > 3 && (
                                <span className="text-[11px] text-muted-foreground">외 {entry.actions.length - 3}건의 조치가 더 있습니다.</span>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1 text-xs">
                          <div className="flex gap-1">
                            <Badge variant="outline" className="border-emerald-200 text-emerald-700">
                              통과 {entry.passed}
                            </Badge>
                            <Badge variant="outline" className="border-amber-200 text-amber-700">
                              경고 {entry.warned}
                            </Badge>
                            <Badge variant="outline" className="border-rose-200 text-rose-700">
                              폐기 {entry.discarded}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              {"층별장 관리"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              층별장 임명 기능은 백엔드 연동이 준비되는 대로 제공될 예정입니다.
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}

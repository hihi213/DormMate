"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { ClipboardCheck, ListChecks, ShieldCheck, Loader2 } from "lucide-react"

import BottomNav from "@/components/bottom-nav"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import AuthGuard from "@/features/auth/components/auth-guard"
import { getCurrentUser, logout as doLogout, subscribeAuth, type AuthUser } from "@/lib/auth"
import { SlotSelector } from "@/features/fridge/components/slot-selector"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { fetchFridgeSlots, updateFridgeCompartment } from "@/features/fridge/api"
import type { ResourceStatus, Slot, UpdateCompartmentConfigPayload } from "@/features/fridge/types"
import { formatSlotDisplayName } from "@/features/fridge/utils/labels"
import {
  createInspectionSchedule,
  deleteInspectionSchedule,
  fetchInspectionHistory,
  fetchInspectionSchedules,
  updateInspectionSchedule,
} from "@/features/inspections/api"
import type { InspectionSchedule, InspectionSession } from "@/features/inspections/types"

const ROLE_LABEL = {
  RESIDENT: "거주자",
  FLOOR_MANAGER: "층별장",
  ADMIN: "관리자",
} as const

export default function AdminPage() {
  return (
    <AuthGuard>
      <AdminInner />
      <BottomNav />
    </AuthGuard>
  )
}

function AdminInner() {
  const router = useRouter()
  const isMountedRef = useRef(true)
  const [authUser, setAuthUser] = useState<AuthUser | null>(getCurrentUser())
  const [schedules, setSchedules] = useState<InspectionSchedule[]>([])
  const [history, setHistory] = useState<InspectionSession[]>([])
  const [mounted, setMounted] = useState(false)
  const { toast } = useToast()
  const [slots, setSlots] = useState<Slot[]>([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [selectedSlotId, setSelectedSlotId] = useState<string>("")
  const [formState, setFormState] = useState<{ maxBundleCount: string; status: ResourceStatus }>({
    maxBundleCount: "",
    status: "ACTIVE",
  })
  const [savingSlot, setSavingSlot] = useState(false)
  const [inspectionDataLoading, setInspectionDataLoading] = useState(false)
  const [scheduleForm, setScheduleForm] = useState<{ datetime: string; title: string; notes: string }>({
    datetime: "",
    title: "",
    notes: "",
  })
  const [creatingSchedule, setCreatingSchedule] = useState(false)
  const [scheduleActionId, setScheduleActionId] = useState<string | null>(null)
  const [scheduleDeleteId, setScheduleDeleteId] = useState<string | null>(null)

  useEffect(() => {
    return () => {
      isMountedRef.current = false
    }
  }, [])

  useEffect(() => {
    setMounted(true)
    const unsubscribe = subscribeAuth(setAuthUser)
    return () => unsubscribe()
  }, [])

  const isAdmin = authUser?.roles.includes("ADMIN") ?? false

  const reloadInspectionMeta = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!isAdmin) {
        if (isMountedRef.current) {
          setSchedules([])
          setHistory([])
        }
        return
      }
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
    [isAdmin, toast],
  )

  useEffect(() => {
    if (!mounted || !isAdmin) return
    void reloadInspectionMeta({ silent: true })
  }, [mounted, isAdmin, reloadInspectionMeta])

  useEffect(() => {
    if (mounted && authUser && !authUser.roles.includes("ADMIN")) {
      router.replace("/")
    }
  }, [authUser, mounted, router])

  useEffect(() => {
    if (!mounted || !isAdmin) return
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
  }, [mounted, isAdmin, toast, selectedSlotId])

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

  const recentHistory = useMemo(() => {
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
        return {
          id: session.sessionId,
          occurredAt,
          notes: session.notes ?? undefined,
          ...counts,
        }
      })
  }, [history])

  const handleCreateSchedule = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      if (!scheduleForm.datetime) {
        toast({
          title: "일정 시간을 입력해 주세요.",
          variant: "destructive",
        })
        return
      }
      const date = new Date(scheduleForm.datetime)
      if (Number.isNaN(date.getTime())) {
        toast({
          title: "잘못된 날짜 형식입니다.",
          description: "날짜와 시간을 다시 확인해 주세요.",
          variant: "destructive",
        })
        return
      }
      try {
        setCreatingSchedule(true)
        await createInspectionSchedule({
          scheduledAt: date.toISOString(),
          title: scheduleForm.title.trim() ? scheduleForm.title.trim() : undefined,
          notes: scheduleForm.notes.trim() ? scheduleForm.notes.trim() : undefined,
        })
        if (!isMountedRef.current) return
        setScheduleForm({ datetime: "", title: "", notes: "" })
        toast({
          title: "검사 일정을 추가했습니다.",
        })
        await reloadInspectionMeta()
      } catch (error) {
        if (!isMountedRef.current) return
        console.error("Failed to create inspection schedule", error)
        toast({
          title: "일정을 생성하지 못했습니다.",
          description: error instanceof Error ? error.message : "다시 시도해 주세요.",
          variant: "destructive",
        })
      } finally {
        if (isMountedRef.current) {
          setCreatingSchedule(false)
        }
      }
    },
    [scheduleForm, toast, reloadInspectionMeta],
  )

  const handleCompleteSchedule = useCallback(
    async (scheduleId: string) => {
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
    [reloadInspectionMeta, toast],
  )

  const handleDeleteSchedule = useCallback(
    async (scheduleId: string) => {
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
    [reloadInspectionMeta, toast],
  )

  const selectedSlot = useMemo(() => slots.find((slot) => slot.slotId === selectedSlotId) ?? null, [slots, selectedSlotId])
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

  const handleLogout = useCallback(async () => {
    await doLogout()
    router.replace("/")
  }, [router])
  if (!isAdmin) {
    return (
      <main className="min-h-[100svh] bg-white">
        <div className="mx-auto max-w-screen-sm px-4 py-16 space-y-6 text-center">
          <ShieldCheck className="mx-auto h-12 w-12 text-emerald-600" />
          <h1 className="text-xl font-semibold text-gray-900">관리자 권한이 필요합니다.</h1>
          <p className="text-sm text-muted-foreground">
            이 화면은 DormMate 관리자만 접근할 수 있습니다. 권한이 없다면 메인 페이지로 이동해 주세요.
          </p>
          <Button onClick={() => router.replace("/")}>메인으로 이동</Button>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-[100svh] bg-white pb-28">
      <header className="sticky top-0 z-40 border-b bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="mx-auto flex max-w-screen-sm items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-700" />
            <div>
              <p className="text-sm font-medium text-gray-700">DormMate Admin</p>
              <p className="text-xs text-muted-foreground">{authUser?.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{ROLE_LABEL.ADMIN}</Badge>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              로그아웃
            </Button>
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
              검사 일정 등록
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateSchedule} className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground" htmlFor="schedule-datetime">
                  일정 시간
                </Label>
                <Input
                  id="schedule-datetime"
                  type="datetime-local"
                  value={scheduleForm.datetime}
                  onChange={(event) =>
                    setScheduleForm((prev) => ({ ...prev, datetime: event.target.value }))
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground" htmlFor="schedule-title">
                  제목 (선택)
                </Label>
                <Input
                  id="schedule-title"
                  value={scheduleForm.title}
                  onChange={(event) =>
                    setScheduleForm((prev) => ({ ...prev, title: event.target.value }))
                  }
                  placeholder="예: 11월 정기 점검"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground" htmlFor="schedule-notes">
                  메모 (선택)
                </Label>
                <Textarea
                  id="schedule-notes"
                  value={scheduleForm.notes}
                  onChange={(event) =>
                    setScheduleForm((prev) => ({ ...prev, notes: event.target.value }))
                  }
                  rows={3}
                  placeholder="점검 전 준비 사항을 남겨 주세요."
                />
              </div>
              <div className="flex justify-end">
                <Button type="submit" disabled={creatingSchedule}>
                  {creatingSchedule && <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />}
                  일정 추가
                </Button>
              </div>
            </form>
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
                            disabled={completing || deleting}
                          >
                            {completing && <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />}
                            완료 처리
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-rose-200 text-rose-600 hover:bg-rose-50"
                            onClick={() => handleDeleteSchedule(entry.scheduleId)}
                            disabled={deleting || completing}
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
                {recentHistory.map((entry) => (
                  <li key={entry.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {new Date(entry.occurredAt ?? "").toLocaleString("ko-KR", {
                          month: "numeric",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                      {entry.notes && <div className="text-xs text-muted-foreground">{entry.notes}</div>}
                    </div>
                    <div className="flex gap-1 text-xs">
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
                  </li>
                ))}
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

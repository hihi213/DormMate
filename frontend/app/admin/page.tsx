"use client"

import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { ClipboardCheck, ListChecks, ShieldCheck, Loader2 } from "lucide-react"

import BottomNav from "@/components/bottom-nav"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import AuthGuard from "@/features/auth/components/auth-guard"
import { getCurrentUser, subscribeAuth, type AuthUser } from "@/lib/auth"
import { SlotSelector } from "@/features/fridge/components/slot-selector"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import {
  fetchFridgeSlots,
  updateFridgeCompartment,
} from "@/features/fridge/api"
import type { ResourceStatus, Slot, UpdateCompartmentConfigPayload } from "@/features/fridge/types"

const SCHEDULE_STORAGE_KEY = "fridge-inspections-schedule-v1"
const HISTORY_STORAGE_KEY = "fridge-inspections-history-v1"

type Schedule = {
  id: string
  dateISO: string
  title?: string
  notes?: string
  completed?: boolean
  completedAt?: string
  completedBy?: string
  summary?: { passed: number; warned: number; discarded: number }
}

type HistoryRecord = {
  id: string
  dateISO: string
  passed?: number
  warned?: number
  discarded?: number
  notes?: string
}

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
  const [authUser, setAuthUser] = useState<AuthUser | null>(getCurrentUser())
  const [schedule, setSchedule] = useState<Schedule[]>([])
  const [history, setHistory] = useState<HistoryRecord[]>([])
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

  useEffect(() => {
    setMounted(true)
    const unsubscribe = subscribeAuth(setAuthUser)
    return () => unsubscribe()
  }, [])

  useEffect(() => {
    if (!mounted) return
    if (typeof window === "undefined") return
    try {
      const rawSchedule = JSON.parse(localStorage.getItem(SCHEDULE_STORAGE_KEY) || "null") as Schedule[] | null
      if (Array.isArray(rawSchedule)) {
        setSchedule(rawSchedule)
      }
    } catch {
      setSchedule([])
    }

    try {
      const rawHistory = JSON.parse(localStorage.getItem(HISTORY_STORAGE_KEY) || "null") as HistoryRecord[] | null
      if (Array.isArray(rawHistory)) {
        setHistory(rawHistory)
      }
    } catch {
      setHistory([])
    }
  }, [mounted])

  const isAdmin = authUser?.roles.includes("ADMIN")

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

  const upcomingSchedules = useMemo(
    () =>
      schedule
        .filter((entry) => !entry.completed)
        .slice()
        .sort((a, b) => a.dateISO.localeCompare(b.dateISO)),
    [schedule],
  )

  const entryTime = (entry: Schedule) => entry.completedAt ?? entry.dateISO

  const completedSchedules = useMemo(
    () =>
      schedule
        .filter((entry) => entry.completed)
        .slice()
        .sort((a, b) => entryTime(b).localeCompare(entryTime(a))),
    [schedule],
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
          description: `${updated.displayName ?? updated.slotLetter} 설정이 갱신되었습니다.`,
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
          <Badge variant="outline">{ROLE_LABEL.ADMIN}</Badge>
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
            {upcomingSchedules.length === 0 ? (
              <p className="text-sm text-muted-foreground">예정된 검사가 없습니다.</p>
            ) : (
              <ul className="space-y-2">
                {upcomingSchedules.map((entry) => (
                  <li key={entry.id} className="rounded-md border px-3 py-2">
                    <div className="text-sm font-medium text-gray-900">{entry.title ?? "검사"}</div>
                    <div className="text-xs text-muted-foreground">{new Date(entry.dateISO).toLocaleString("ko-KR")}</div>
                    {entry.notes && <div className="mt-1 text-xs text-muted-foreground">{entry.notes}</div>}
                  </li>
                ))}
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
            {history.length === 0 ? (
              <p className="text-sm text-muted-foreground">최근 제출된 검사 결과가 없습니다.</p>
            ) : (
              <ul className="space-y-2">
                {history.slice(0, 3).map((entry) => (
                  <li key={entry.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {new Date(entry.dateISO).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </div>
                      {entry.notes && <div className="text-xs text-muted-foreground">{entry.notes}</div>}
                    </div>
                    <div className="flex gap-1 text-xs">
                      <Badge variant="outline" className="border-emerald-200 text-emerald-700">
                        통과 {entry.passed ?? 0}
                      </Badge>
                      <Badge variant="outline" className="border-amber-200 text-amber-700">
                        경고 {entry.warned ?? 0}
                      </Badge>
                      <Badge variant="outline" className="border-rose-200 text-rose-700">
                        폐기 {entry.discarded ?? 0}
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

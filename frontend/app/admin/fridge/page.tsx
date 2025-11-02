"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeftRight,
  ArrowRight,
  History,
  Loader2,
  Lock,
  LockOpen,
  Search,
  Shuffle,
  Snowflake,
} from "lucide-react"
import { format, formatDistanceToNowStrict, parseISO, subMonths } from "date-fns"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import {
  applyReallocation,
  fetchAdminBundleList,
  fetchAdminCompartments,
  fetchAdminDeletedBundles,
  fetchAdminInspectionSessions,
  previewReallocation,
  type AdminBundleListResponseDto,
  type AdminReallocationPreviewDto,
} from "@/features/admin/api/fridge"
import {
  mapAdminBundleSummary,
  mapAdminInspectionSession,
  mapAdminSlot,
  type AdminBundleSummary,
  type AdminFridgeSlot,
  type AdminInspectionSession,
} from "@/features/admin/utils/fridge-adapter"
import type { ResourceStatus } from "@/features/fridge/types"

const FLOOR_OPTIONS = [2, 3, 4, 5]
const BUNDLE_PAGE_SIZE = 8
const DELETED_PAGE_SIZE = 10

const STATUS_BADGE: Record<ResourceStatus, { label: string; className: string }> = {
  ACTIVE: { label: "운영중", className: "bg-emerald-100 text-emerald-700" },
  SUSPENDED: { label: "일시 중단", className: "bg-amber-100 text-amber-700" },
  REPORTED: { label: "이슈 있음", className: "bg-rose-100 text-rose-700" },
  RETIRED: { label: "퇴역", className: "bg-slate-200 text-slate-600" },
}

const FRESHNESS_LABEL: Record<string, { label: string; className: string }> = {
  ok: { label: "정상", className: "bg-emerald-100 text-emerald-700" },
  expiring: { label: "임박", className: "bg-amber-100 text-amber-700" },
  expired: { label: "만료", className: "bg-rose-100 text-rose-700" },
}

const INSPECTION_STATUS_LABEL: Record<AdminInspectionSession["status"], string> = {
  IN_PROGRESS: "진행 중",
  SUBMITTED: "제출 완료",
  CANCELED: "취소됨",
}

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

function formatFreshness(freshness?: string | null) {
  if (!freshness) return null
  const entry = FRESHNESS_LABEL[freshness.toLowerCase()]
  if (!entry) return null
  return entry
}

type DeletedState = {
  open: boolean
  loading: boolean
  error: string | null
  page: number
  sinceMonths: number
  response: AdminBundleListResponseDto | null
}

type BundleState = {
  loading: boolean
  error: string | null
  items: AdminBundleSummary[]
  totalCount: number
  page: number
  search: string
}

type InspectionState = {
  loading: boolean
  error: string | null
  items: AdminInspectionSession[]
  status: AdminInspectionSession["status"] | "ALL"
}

export default function AdminFridgePage() {
  const { toast } = useToast()
  const [selectedFloor, setSelectedFloor] = useState<number>(FLOOR_OPTIONS[0]!)
  const [slots, setSlots] = useState<AdminFridgeSlot[]>([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [slotsError, setSlotsError] = useState<string | null>(null)
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null)

  const [bundleState, setBundleState] = useState<BundleState>({
    loading: false,
    error: null,
    items: [],
    totalCount: 0,
    page: 0,
    search: "",
  })
  const [bundleSearchInput, setBundleSearchInput] = useState("")

  const [inspectionState, setInspectionState] = useState<InspectionState>({
    loading: false,
    error: null,
    items: [],
    status: "SUBMITTED",
  })

  const [deletedState, setDeletedState] = useState<DeletedState>({
    open: false,
    loading: false,
    error: null,
    page: 0,
    sinceMonths: 3,
    response: null,
  })

  const [reallocationOpen, setReallocationOpen] = useState(false)
  const [reallocationLoading, setReallocationLoading] = useState(false)
  const [reallocationPreview, setReallocationPreview] = useState<AdminReallocationPreviewDto | null>(null)
  const [reallocationSelections, setReallocationSelections] = useState<Record<string, string[]>>({})
  const [reallocationError, setReallocationError] = useState<string | null>(null)
  const [reallocationApplying, setReallocationApplying] = useState(false)

  const selectedSlot = useMemo(
    () => slots.find((slot) => slot.slotId === selectedSlotId) ?? null,
    [slots, selectedSlotId],
  )

  const loadSlots = useCallback(
    async (floor: number) => {
      setSlotsLoading(true)
      setSlotsError(null)
      try {
        const response = await fetchAdminCompartments({ floor })
        const mapped = response.map(mapAdminSlot)
        setSlots(mapped)
        if (!mapped.find((slot) => slot.slotId === selectedSlotId)) {
          setSelectedSlotId(mapped[0]?.slotId ?? null)
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "칸 정보를 불러오는 중 오류가 발생했습니다."
        setSlotsError(message)
        toast({
          title: "칸 정보를 불러오지 못했습니다.",
          description: message,
          variant: "destructive",
        })
      } finally {
        setSlotsLoading(false)
      }
    },
    [selectedSlotId, toast],
  )

  useEffect(() => {
    void loadSlots(selectedFloor)
  }, [selectedFloor, loadSlots])

  useEffect(() => {
    if (!selectedSlotId) return
    setBundleState((prev) => ({ ...prev, loading: true, error: null }))
    let active = true
    const load = async () => {
      try {
        const data = await fetchAdminBundleList({
          slotId: selectedSlotId,
          search: bundleState.search,
          page: bundleState.page,
          size: BUNDLE_PAGE_SIZE,
          owner: "all",
          status: "active",
        })
        if (!active) return
        setBundleState((prev) => ({
          ...prev,
          loading: false,
          items: data.items.map(mapAdminBundleSummary),
          totalCount: data.totalCount ?? data.items.length,
        }))
      } catch (error) {
        if (!active) return
        const message =
          error instanceof Error ? error.message : "포장 목록을 불러오는 중 오류가 발생했습니다."
        setBundleState((prev) => ({
          ...prev,
          loading: false,
          error: message,
          items: [],
          totalCount: 0,
        }))
      }
    }
    void load()
    return () => {
      active = false
    }
  }, [selectedSlotId, bundleState.search, bundleState.page])

  useEffect(() => {
    if (!selectedSlotId) return
    setInspectionState((prev) => ({ ...prev, loading: true, error: null }))
    let active = true
    const load = async () => {
      try {
        const statusParam =
          inspectionState.status === "ALL" ? undefined : inspectionState.status
        const sessions = await fetchAdminInspectionSessions({
          slotId: selectedSlotId,
          status: statusParam,
          limit: 10,
        })
        if (!active) return
        setInspectionState((prev) => ({
          ...prev,
          loading: false,
          items: sessions.map(mapAdminInspectionSession),
        }))
      } catch (error) {
        if (!active) return
        const message =
          error instanceof Error ? error.message : "검사 기록을 불러오는 중 오류가 발생했습니다."
        setInspectionState((prev) => ({
          ...prev,
          loading: false,
          error: message,
          items: [],
        }))
      }
    }
    void load()
    return () => {
      active = false
    }
  }, [selectedSlotId, inspectionState.status])

  const stats = useMemo(() => {
    if (slots.length === 0) {
      return {
        total: 0,
        active: 0,
        locked: 0,
        utilization: null as number | null,
      }
    }
    const total = slots.length
    const active = slots.filter((slot) => slot.resourceStatus === "ACTIVE").length
    const locked = slots.filter((slot) => slot.locked).length
    const capacitySum = slots.reduce(
      (acc, slot) => acc + (typeof slot.capacity === "number" ? slot.capacity : 0),
      0,
    )
    const occupiedSum = slots.reduce(
      (acc, slot) => acc + (typeof slot.occupiedCount === "number" ? slot.occupiedCount : 0),
      0,
    )
    const utilization =
      capacitySum > 0 ? Math.round((occupiedSum / capacitySum) * 100) : null
    return { total, active, locked, utilization }
  }, [slots])

  const totalBundlePages = useMemo(
    () => Math.max(1, Math.ceil(bundleState.totalCount / BUNDLE_PAGE_SIZE)),
    [bundleState.totalCount],
  )

  const handleSearchSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setBundleState((prev) => ({
      ...prev,
      page: 0,
      search: bundleSearchInput.trim(),
    }))
  }

  const handleResetSearch = () => {
    setBundleSearchInput("")
    setBundleState((prev) => ({ ...prev, page: 0, search: "" }))
  }

  const handleDeletedOpenChange = (open: boolean) => {
    setDeletedState((prev) => ({ ...prev, open }))
    if (!open) return
    void loadDeletedBundles(0, deletedState.sinceMonths)
  }

  const loadDeletedBundles = async (page: number, months: number) => {
    setDeletedState((prev) => ({
      ...prev,
      loading: true,
      error: null,
      page,
      sinceMonths: months,
    }))
    try {
      const since =
        months > 0 ? subMonths(new Date(), months).toISOString() : undefined
      const response = await fetchAdminDeletedBundles({
        page,
        size: DELETED_PAGE_SIZE,
        since,
      })
      setDeletedState((prev) => ({
        ...prev,
        loading: false,
        response,
      }))
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "삭제된 포장 이력을 불러오는 중 오류가 발생했습니다."
      setDeletedState((prev) => ({
        ...prev,
        loading: false,
        error: message,
        response: null,
      }))
    }
  }

  const handleDeletedPageChange = (direction: "prev" | "next") => {
    const nextPage =
      direction === "prev" ? Math.max(0, deletedState.page - 1) : deletedState.page + 1
    void loadDeletedBundles(nextPage, deletedState.sinceMonths)
  }

  const handleDeletedRangeChange = (value: number) => {
    void loadDeletedBundles(0, value)
  }

  const handleToggleRoomSelection = (compartmentId: string, roomId: string, checked: boolean) => {
    setReallocationSelections((prev) => {
      const current = prev[compartmentId] ?? []
      const next = checked
        ? Array.from(new Set([...current, roomId]))
        : current.filter((value) => value !== roomId)
      return { ...prev, [compartmentId]: next }
    })
  }

  const handleResetRoomSelection = (compartmentId: string) => {
    if (!reallocationPreview) return
    const allocation = reallocationPreview.allocations.find(
      (item) => item.compartmentId === compartmentId,
    )
    if (!allocation) return
    setReallocationSelections((prev) => ({
      ...prev,
      [compartmentId]: [...allocation.recommendedRoomIds],
    }))
  }

  const handleReallocationOpenChange = (open: boolean) => {
    setReallocationOpen(open)
    if (!open) {
      setReallocationPreview(null)
      setReallocationError(null)
      setReallocationSelections({})
      return
    }
    if (!selectedFloor) return
    setReallocationLoading(true)
    setReallocationError(null)
    let active = true
    const load = async () => {
      try {
        const preview = await previewReallocation(selectedFloor)
        if (!active) return
        setReallocationPreview(preview)
        const initialSelections: Record<string, string[]> = {}
        preview.allocations.forEach((allocation) => {
          initialSelections[allocation.compartmentId] = [...allocation.recommendedRoomIds]
        })
        setReallocationSelections(initialSelections)
      } catch (error) {
        if (!active) return
        const message =
          error instanceof Error ? error.message : "재배분 추천안을 불러오는 중 오류가 발생했습니다."
        setReallocationError(message)
      } finally {
        if (active) setReallocationLoading(false)
      }
    }
    void load()
    return () => {
      active = false
    }
  }

  const handleApplyReallocation = async () => {
    if (!reallocationPreview || !selectedFloor) return
    setReallocationApplying(true)
    try {
      const payload = {
        floor: selectedFloor,
        allocations: reallocationPreview.allocations.map((allocation) => ({
          compartmentId: allocation.compartmentId,
          roomIds: reallocationSelections[allocation.compartmentId] ?? [],
        })),
      }
      const result = await applyReallocation(payload)
      toast({
        title: "재배분이 완료되었습니다.",
        description: `적용된 칸 ${result.affectedCompartments}개, 새 배정 ${result.createdAssignments}건`,
      })
      setReallocationOpen(false)
      setReallocationPreview(null)
      setReallocationSelections({})
      await loadSlots(selectedFloor)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "재배분 적용 중 오류가 발생했습니다."
      toast({
        title: "재배분 적용 실패",
        description: message,
        variant: "destructive",
      })
    } finally {
      setReallocationApplying(false)
    }
  }

  const roomsMap = useMemo(() => {
    if (!reallocationPreview) return new Map<string, string>()
    const map = new Map<string, string>()
    reallocationPreview.rooms.forEach((room) => {
      map.set(room.roomId, room.roomNumber)
    })
    return map
  }, [reallocationPreview])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-emerald-100 p-2">
            <Snowflake className="size-5 text-emerald-600" aria-hidden />
          </span>
          <div>
            <h1 className="text-xl font-semibold text-slate-900">냉장고 칸 운영 현황</h1>
            <p className="text-sm text-slate-500">
              층별 칸 상태, 검사 결과, 포장 목록을 한 화면에서 확인하고 조치하세요.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={String(selectedFloor)}
            onValueChange={(value) => {
              const parsed = Number(value)
              setSelectedFloor(Number.isNaN(parsed) ? FLOOR_OPTIONS[0]! : parsed)
            }}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="층 선택" />
            </SelectTrigger>
            <SelectContent>
              {FLOOR_OPTIONS.map((floor) => (
                <SelectItem key={floor} value={String(floor)}>
                  {floor}층
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Dialog open={reallocationOpen} onOpenChange={handleReallocationOpenChange}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Shuffle className="size-4" aria-hidden />
                호실 재배분
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl">
              <DialogHeader>
                <DialogTitle>{selectedFloor}층 칸-호실 재배분</DialogTitle>
                <DialogDescription>
                  추천안을 검토하고 필요 시 조정한 뒤 적용하세요. 잠금·검사 중인 칸은 별도 해제 후 시도해야
                  합니다.
                </DialogDescription>
              </DialogHeader>
              {reallocationLoading ? (
                <div className="flex items-center justify-center py-16 text-slate-500">
                  <Loader2 className="mr-2 size-5 animate-spin" aria-hidden />
                  재배분 추천안을 불러오는 중입니다…
                </div>
              ) : reallocationError ? (
                <div className="rounded-md border border-rose-200 bg-rose-50 p-4 text-sm text-rose-600">
                  {reallocationError}
                </div>
              ) : reallocationPreview ? (
                <>
                  <ScrollArea className="max-h-[420px] pr-4">
                    <div className="space-y-4">
                      {reallocationPreview.allocations.map((allocation) => {
                        const selectedRooms = reallocationSelections[allocation.compartmentId] ?? []
                        const recommendedRooms = allocation.recommendedRoomIds ?? []
                        const warnings = allocation.warnings ?? []
                        const statusBadge = STATUS_BADGE[allocation.status as ResourceStatus]
                        const roomNumbers = selectedRooms
                          .map((roomId) => roomsMap.get(roomId) ?? roomId.slice(0, 8))
                          .join(", ") || "미배정"
                        const recommendedNumbers = recommendedRooms
                          .map((roomId) => roomsMap.get(roomId) ?? roomId.slice(0, 8))
                          .join(", ") || "없음"
                        return (
                          <div
                            key={allocation.compartmentId}
                            className="rounded-lg border border-slate-200 p-4 shadow-sm"
                          >
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-semibold text-slate-900">
                                    {allocation.slotLabel} · {allocation.compartmentType}
                                  </p>
                                  {statusBadge ? (
                                    <Badge className={statusBadge.className}>{statusBadge.label}</Badge>
                                  ) : null}
                                  <Badge
                                    variant={allocation.locked ? "destructive" : "outline"}
                                    className={cn(
                                      "gap-1",
                                      allocation.locked ? "border-rose-200 bg-rose-50 text-rose-600" : "border-emerald-200 text-emerald-600",
                                    )}
                                  >
                                    {allocation.locked ? (
                                      <>
                                        <Lock className="size-3" aria-hidden />
                                        잠금
                                      </>
                                    ) : (
                                      <>
                                        <LockOpen className="size-3" aria-hidden />
                                        잠금 해제
                                      </>
                                    )}
                                  </Badge>
                                </div>
                                <p className="text-xs text-slate-500">
                                  현재 배정:{" "}
                                  {allocation.currentRoomIds
                                    .map((roomId) => roomsMap.get(roomId) ?? roomId.slice(0, 8))
                                    .join(", ") || "없음"}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="outline" size="sm" className="gap-2">
                                      <ArrowLeftRight className="size-3.5" aria-hidden />
                                      {roomNumbers}
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent className="max-h-64 overflow-y-auto">
                                    <DropdownMenuLabel>배정 호실 선택</DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    {reallocationPreview.rooms.map((room) => (
                                      <DropdownMenuCheckboxItem
                                        key={room.roomId}
                                        checked={selectedRooms.includes(room.roomId)}
                                        onCheckedChange={(checked) =>
                                          handleToggleRoomSelection(
                                            allocation.compartmentId,
                                            room.roomId,
                                            Boolean(checked),
                                          )
                                        }
                                      >
                                        {room.roomNumber}
                                      </DropdownMenuCheckboxItem>
                                    ))}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleResetRoomSelection(allocation.compartmentId)}
                                >
                                  추천값
                                </Button>
                              </div>
                            </div>
                            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                              <span>
                                추천 배정: <span className="font-medium text-slate-700">{recommendedNumbers}</span>
                              </span>
                              {warnings.map((warning) => (
                                <Badge key={warning} variant="destructive" className="gap-1">
                                  <AlertTriangle className="size-3" aria-hidden />
                                  {warning}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </ScrollArea>
                  <DialogFooter className="mt-4 flex-col gap-2 sm:flex-row sm:justify-between">
                    <p className="text-xs text-slate-500">
                      잠금 또는 검사 중인 칸은 우선 해제 후 재배분을 적용해야 합니다. 적용 후 목록이 자동으로
                      갱신됩니다.
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={() => setReallocationOpen(false)}
                        disabled={reallocationApplying}
                      >
                        취소
                      </Button>
                      <Button onClick={handleApplyReallocation} disabled={reallocationApplying}>
                        {reallocationApplying ? (
                          <>
                            <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                            적용 중…
                          </>
                        ) : (
                          "재배분 적용"
                        )}
                      </Button>
                    </div>
                  </DialogFooter>
                </>
              ) : (
                <div className="py-10 text-center text-sm text-slate-500">
                  추천 데이터를 불러오지 못했습니다.
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">총 칸 수</CardTitle>
            <Snowflake className="size-4 text-emerald-600" aria-hidden />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
            <p className="text-xs text-slate-500">선택한 {selectedFloor}층 기준</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">운영 중</CardTitle>
            <Badge variant="outline" className="border-emerald-200 text-emerald-700">
              ACTIVE
            </Badge>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-slate-900">{stats.active}</p>
            <p className="text-xs text-slate-500">내부 상태가 정상인 칸</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">잠금 상태</CardTitle>
            <Lock className="size-4 text-amber-600" aria-hidden />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-slate-900">{stats.locked}</p>
            <p className="text-xs text-slate-500">검사·고장 등으로 잠금</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">평균 활용률</CardTitle>
            <ArrowRight className="size-4 text-slate-500" aria-hidden />
          </CardHeader>
          <CardContent>
            {typeof stats.utilization === "number" ? (
              <>
                <p className="text-2xl font-bold text-slate-900">{stats.utilization}%</p>
                <Progress value={stats.utilization} className="mt-2 h-2" />
              </>
            ) : (
              <p className="text-sm text-slate-500">용량 정보가 없는 칸입니다.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">칸 목록</h2>
            <p className="text-xs text-slate-500">
              카드를 선택하면 포장/검사 상세가 우측 패널에 표시됩니다.
            </p>
          </div>
          {slotsLoading ? (
            <div className="flex items-center justify-center rounded-lg border border-dashed border-emerald-200 bg-emerald-50/40 py-12 text-sm text-emerald-700">
              <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
              칸 정보를 불러오는 중입니다…
            </div>
          ) : slotsError ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-600">
              {slotsError}
            </div>
          ) : slots.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
              선택한 층에 표시할 칸이 없습니다.
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {slots.map((slot) => {
                const badge = STATUS_BADGE[slot.resourceStatus]
                const isSelected = slot.slotId === selectedSlotId
                const utilization =
                  typeof slot.utilization === "number" ? Math.round(slot.utilization * 100) : null
                return (
                  <button
                    key={slot.slotId}
                    type="button"
                    onClick={() => setSelectedSlotId(slot.slotId)}
                    className={cn(
                      "flex h-full flex-col rounded-xl border bg-white p-4 text-left shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2",
                      isSelected
                        ? "border-emerald-400 ring-1 ring-emerald-200"
                        : "border-slate-200 hover:border-emerald-200 hover:shadow-md",
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {slot.displayName ?? `${slot.floorNo}F · ${slot.slotLetter}`}
                        </p>
                        <p className="text-xs text-slate-500">
                          {slot.compartmentType} · 인덱스 {slot.slotIndex}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        {badge ? (
                          <Badge className={badge.className}>{badge.label}</Badge>
                        ) : null}
                        <Badge
                          variant={slot.locked ? "destructive" : "outline"}
                          className={cn(
                            "gap-1",
                            slot.locked
                              ? "border-rose-200 bg-rose-50 text-rose-600"
                              : "border-emerald-200 text-emerald-600",
                          )}
                        >
                          {slot.locked ? (
                            <>
                              <Lock className="size-3" aria-hidden />
                              잠금
                            </>
                          ) : (
                            <>
                              <LockOpen className="size-3" aria-hidden />
                              해제
                            </>
                          )}
                        </Badge>
                      </div>
                    </div>
                    <Separator className="my-3" />
                    <div className="flex items-baseline justify-between">
                      <div>
                        <p className="text-2xl font-semibold text-slate-900">
                          {typeof slot.occupiedCount === "number" ? slot.occupiedCount : "-"}
                          <span className="text-base font-medium text-slate-400">
                            /{typeof slot.capacity === "number" ? slot.capacity : "-"}
                          </span>
                        </p>
                        <p className="text-xs text-slate-500">점유/용량</p>
                      </div>
                      {utilization !== null ? (
                        <div className="text-right">
                          <p className="text-sm font-semibold text-emerald-600">{utilization}%</p>
                          <p className="text-xs text-slate-500">활용률</p>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400">용량 정보 없음</p>
                      )}
                    </div>
                    {utilization !== null ? (
                      <Progress value={utilization} className="mt-3 h-2" />
                    ) : null}
                    <div className="mt-3 flex items-center justify-between text-xs">
                      <span className="text-slate-500">
                        마지막 갱신 {formatRelative(slot.lockedUntil) || "-"}
                      </span>
                      {isSelected ? (
                        <Badge className="bg-emerald-100 text-emerald-700">선택됨</Badge>
                      ) : (
                        <span className="text-emerald-600">상세 보기</span>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">상세</h2>
            {selectedSlot ? (
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span>{selectedSlot.displayName ?? `${selectedSlot.floorNo}F ${selectedSlot.slotLetter}`}</span>
                <Separator orientation="vertical" className="h-4" />
                <Link
                  href={`/admin/audit?module=fridge&slotId=${selectedSlot.slotId}`}
                  className="flex items-center gap-1 text-emerald-600"
                >
                  감사 로그 이동
                  <ArrowRight className="size-3" aria-hidden />
                </Link>
              </div>
            ) : null}
          </div>
          {selectedSlot ? (
            <Tabs defaultValue="bundles" className="space-y-4">
              <TabsList>
                <TabsTrigger value="bundles">포장 목록</TabsTrigger>
                <TabsTrigger value="inspections">검사 기록</TabsTrigger>
              </TabsList>
              <TabsContent value="bundles" className="space-y-4">
                <form onSubmit={handleSearchSubmit}>
                  <Label htmlFor="bundle-search" className="mb-2 block text-xs text-slate-500">
                    라벨·포장명·호실 검색
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="bundle-search"
                      placeholder="예: A301, 김도미, 과일"
                      value={bundleSearchInput}
                      onChange={(event) => setBundleSearchInput(event.target.value)}
                    />
                    <Button type="submit" className="gap-1">
                      <Search className="size-4" aria-hidden />
                      검색
                    </Button>
                    <Button type="button" variant="ghost" onClick={handleResetSearch}>
                      초기화
                    </Button>
                  </div>
                </form>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-slate-500">
                    총 {bundleState.totalCount.toLocaleString()}건 · 페이지 {bundleState.page + 1}/
                    {totalBundlePages}
                  </p>
                  <Dialog open={deletedState.open} onOpenChange={handleDeletedOpenChange}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" className="gap-2">
                        <History className="size-4" aria-hidden />
                        삭제 이력
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-3xl">
                      <DialogHeader>
                        <DialogTitle>삭제된 포장 목록</DialogTitle>
                        <DialogDescription>
                          최근 {deletedState.sinceMonths}개월 이내 삭제된 포장을 확인할 수 있습니다.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <span>조회 범위</span>
                          <Select
                            value={String(deletedState.sinceMonths)}
                            onValueChange={(value) => handleDeletedRangeChange(Number(value))}
                          >
                            <SelectTrigger className="h-8 w-[120px]">
                              <SelectValue placeholder="최근 3개월" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="3">최근 3개월</SelectItem>
                              <SelectItem value="6">최근 6개월</SelectItem>
                              <SelectItem value="12">최근 12개월</SelectItem>
                              <SelectItem value="0">전체</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeletedPageChange("prev")}
                            disabled={deletedState.page === 0 || deletedState.loading}
                          >
                            이전
                          </Button>
                          <span>
                            {deletedState.page + 1} 페이지 /{" "}
                            {Math.max(
                              1,
                              Math.ceil(
                                (deletedState.response?.totalCount ?? 0) / DELETED_PAGE_SIZE,
                              ),
                            )}
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeletedPageChange("next")}
                            disabled={deletedState.loading}
                          >
                            다음
                          </Button>
                        </div>
                      </div>
                      {deletedState.loading ? (
                        <div className="flex items-center justify-center py-16 text-sm text-slate-500">
                          <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                          삭제 이력을 불러오는 중입니다…
                        </div>
                      ) : deletedState.error ? (
                        <div className="rounded-md border border-rose-200 bg-rose-50 p-4 text-sm text-rose-600">
                          {deletedState.error}
                        </div>
                      ) : (
                        <ScrollArea className="max-h-[360px]">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-[120px]">라벨</TableHead>
                                <TableHead>포장명</TableHead>
                                <TableHead>보관자</TableHead>
                                <TableHead>삭제 시각</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {(deletedState.response?.items ?? []).map((item) => {
                                const bundle = mapAdminBundleSummary(item)
                                const deletedAt =
                                  bundle.deletedAt ?? bundle.removedAt ?? bundle.updatedAt
                                return (
                                  <TableRow key={`${bundle.bundleId}-${deletedAt}`}>
                                    <TableCell className="font-medium">{bundle.labelDisplay}</TableCell>
                                    <TableCell>{bundle.bundleName}</TableCell>
                                    <TableCell>
                                      {bundle.ownerDisplayName ?? bundle.ownerRoomNumber ?? "-"}
                                    </TableCell>
                                    <TableCell>
                                      <div className="text-xs font-medium text-slate-700">
                                        {formatDateTime(deletedAt, "-")}
                                      </div>
                                      <div className="text-[11px] text-slate-400">
                                        {formatRelative(deletedAt) || "-"}
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                )
                              })}
                            </TableBody>
                          </Table>
                        </ScrollArea>
                      )}
                    </DialogContent>
                  </Dialog>
                </div>
                <div className="rounded-lg border border-slate-200">
                  {bundleState.loading ? (
                    <div className="flex items-center justify-center py-12 text-sm text-slate-500">
                      <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                      포장 목록을 불러오는 중입니다…
                    </div>
                  ) : bundleState.error ? (
                    <div className="p-4 text-sm text-rose-600">{bundleState.error}</div>
                  ) : bundleState.items.length === 0 ? (
                    <div className="p-4 text-sm text-slate-500">
                      조건에 맞는 포장이 없습니다. 검색어와 필터를 조정해 보세요.
                    </div>
                  ) : (
                    <ScrollArea className="max-h-[360px]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[120px]">라벨</TableHead>
                            <TableHead>포장명</TableHead>
                            <TableHead>보관자</TableHead>
                            <TableHead>상태</TableHead>
                            <TableHead>최근 업데이트</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {bundleState.items.map((bundle) => {
                            const freshnessBadge = formatFreshness(bundle.freshness)
                            return (
                              <TableRow key={bundle.bundleId}>
                                <TableCell className="font-medium">{bundle.labelDisplay}</TableCell>
                                <TableCell>
                                  <div className="font-medium text-slate-900">{bundle.bundleName}</div>
                                  {bundle.memo ? (
                                    <p className="text-xs text-slate-500">{bundle.memo}</p>
                                  ) : null}
                                </TableCell>
                                <TableCell>
                                  <p className="text-sm text-slate-700">
                                    {bundle.ownerDisplayName ?? "-"}
                                  </p>
                                  <p className="text-xs text-slate-500">
                                    {bundle.ownerRoomNumber ?? "호실 정보 없음"}
                                  </p>
                                </TableCell>
                                <TableCell className="space-y-1">
                                  <Badge variant="outline" className="border-slate-200">
                                    {bundle.status}
                                  </Badge>
                                  {freshnessBadge ? (
                                    <Badge className={freshnessBadge.className}>
                                      {freshnessBadge.label}
                                    </Badge>
                                  ) : null}
                                </TableCell>
                                <TableCell>
                                  <div className="text-xs font-medium text-slate-700">
                                    {formatDateTime(bundle.updatedAt, "-")}
                                  </div>
                                  <div className="text-[11px] text-slate-400">
                                    {formatRelative(bundle.updatedAt) || "-"}
                                  </div>
                                </TableCell>
                              </TableRow>
                            )
                          })}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  )}
                </div>
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setBundleState((prev) => ({
                          ...prev,
                          page: Math.max(0, prev.page - 1),
                        }))
                      }
                      disabled={bundleState.page === 0 || bundleState.loading}
                    >
                      이전
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setBundleState((prev) => ({
                          ...prev,
                          page: Math.min(totalBundlePages - 1, prev.page + 1),
                        }))
                      }
                      disabled={bundleState.page >= totalBundlePages - 1 || bundleState.loading}
                    >
                      다음
                    </Button>
                  </div>
                  <span>
                    {bundleState.page + 1} / {totalBundlePages} 페이지
                  </span>
                </div>
              </TabsContent>
              <TabsContent value="inspections" className="space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <Label htmlFor="inspection-status" className="text-xs text-slate-500">
                      검사 상태
                    </Label>
                    <Select
                      value={inspectionState.status}
                      onValueChange={(value) =>
                        setInspectionState((prev) => ({
                          ...prev,
                          status: value as InspectionState["status"],
                        }))
                      }
                    >
                      <SelectTrigger id="inspection-status" className="mt-1 h-8 w-[160px]">
                        <SelectValue placeholder="상태 선택" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">전체</SelectItem>
                        <SelectItem value="IN_PROGRESS">진행 중</SelectItem>
                        <SelectItem value="SUBMITTED">제출 완료</SelectItem>
                        <SelectItem value="CANCELED">취소됨</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setInspectionState((prev) => ({
                        ...prev,
                        status: "SUBMITTED",
                      }))
                    }
                  >
                    기본값으로
                  </Button>
                </div>
                <div className="rounded-lg border border-slate-200">
                  {inspectionState.loading ? (
                    <div className="flex items-center justify-center py-12 text-sm text-slate-500">
                      <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                      검사 기록을 불러오는 중입니다…
                    </div>
                  ) : inspectionState.error ? (
                    <div className="p-4 text-sm text-rose-600">{inspectionState.error}</div>
                  ) : inspectionState.items.length === 0 ? (
                    <div className="p-4 text-sm text-slate-500">
                      선택한 조건에 해당하는 검사 기록이 없습니다.
                    </div>
                  ) : (
                    <ScrollArea className="max-h-[360px]">
                      <div className="divide-y divide-slate-200">
                        {inspectionState.items.map((inspection) => (
                          <div key={inspection.sessionId} className="p-4">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div>
                                <p className="text-sm font-semibold text-slate-900">
                                  {formatDateTime(inspection.startedAt, "-")}
                                </p>
                                <p className="text-xs text-slate-500">
                                  검사자 {inspection.startedBy.slice(0, 8)} · {inspection.slotLabel}
                                </p>
                              </div>
                              <Badge variant="outline" className="border-slate-200 text-slate-600">
                                {INSPECTION_STATUS_LABEL[inspection.status]}
                              </Badge>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-600">
                              <span className="flex items-center gap-1">
                                <AlertTriangle className="size-3 text-amber-500" aria-hidden />
                                경고 {inspection.warningCount}
                              </span>
                              <span className="flex items-center gap-1">
                                <AlertCircle className="size-3 text-rose-500" aria-hidden />
                                폐기 {inspection.disposalCount}
                              </span>
                              <span>PASS {inspection.passCount}</span>
                            </div>
                            {inspection.summary.length > 0 ? (
                              <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-500">
                                {inspection.summary.map((entry) => (
                                  <div
                                    key={`${inspection.sessionId}-${entry.action}`}
                                    className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2"
                                  >
                                    <p className="font-medium text-slate-700">{entry.action}</p>
                                    <p>{entry.count}건</p>
                                  </div>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          ) : (
            <div className="rounded-lg border border-dashed border-slate-200 p-6 text-sm text-slate-500">
              좌측에서 확인할 칸을 먼저 선택하세요.
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

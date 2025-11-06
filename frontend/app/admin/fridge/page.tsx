"use client"

import Link from "next/link"
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
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
  Settings2,
  Shuffle,
  Snowflake,
  RotateCcw,
} from "lucide-react"
import { format, formatDistanceToNowStrict, parseISO, subMonths } from "date-fns"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { getDefaultErrorMessage } from "@/lib/api-errors"
import { useToast } from "@/hooks/use-toast"
import { useIsMobile } from "@/hooks/use-mobile"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import {
  applyReallocation,
  fetchAdminBundleList,
  fetchAdminCompartments,
  fetchAdminDeletedBundles,
  fetchAdminInspectionSessions,
  updateAdminInspectionSession,
  resendInspectionNotification,
  requestInspectionReinspection,
  previewReallocation,
  type AdminBundleListResponseDto,
  type AdminInspectionSessionDto,
  type AdminReallocationPreviewDto,
  type AdminUpdateInspectionSessionRequestDto,
} from "@/features/admin/api/fridge"
import {
  mapAdminBundleSummary,
  mapAdminInspectionSession,
  mapAdminSlot,
  type AdminBundleSummary,
  type AdminFridgeSlot,
  type AdminInspectionActionDetail,
  type AdminInspectionSession,
} from "@/features/admin/utils/fridge-adapter"
import { updateFridgeCompartment } from "@/features/fridge/api"
import type { ResourceStatus, Slot, UpdateCompartmentConfigPayload } from "@/features/fridge/types"

const FLOOR_OPTIONS = [2, 3, 4, 5]
const BUNDLE_PAGE_SIZE = 8
const DELETED_PAGE_SIZE = 10
const LABEL_REUSE_LOOKBACK_MONTHS = 3

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

const formatInspectorDisplay = (session: AdminInspectionSession) => {
  const name = session.startedByName?.trim()
  if (name) return name

  const login = session.startedByLogin?.trim()
  if (login) return login

  return session.startedBy ? session.startedBy.slice(0, 8) : "-"
}

const RESOURCE_STATUS_OPTIONS: ResourceStatus[] = ["ACTIVE", "SUSPENDED", "REPORTED", "RETIRED"]

type ApiErrorLike = Error & { code?: string; status?: number }

const REALLOCATION_WARNING_LABELS: Record<string, string> = {
  INACTIVE_COMPARTMENT: "비활성 칸",
  COMPARTMENT_LOCKED: "잠김",
  INSPECTION_IN_PROGRESS: "검사 진행 중",
}

const INSPECTION_ACTION_LABELS = {
  WARN_INFO_MISMATCH: "정보 불일치 경고",
  WARN_STORAGE_POOR: "보관 상태 경고",
  DISPOSE_EXPIRED: "유통기한 폐기", // 벌점 부여
  UNREGISTERED_DISPOSE: "미등록 물품 폐기",
  PASS: "정상",
} as const

const INSPECTION_NOTIFICATION_LABELS: Record<string, string> = {
  PENDING: "발송 대기",
  SENT: "발송 완료",
  FAILED: "발송 실패",
  UNREAD: "미확인",
  READ: "확인 완료",
  EXPIRED: "만료",
}

type InspectionActionType = keyof typeof INSPECTION_ACTION_LABELS
const INSPECTION_ACTION_TYPES = Object.keys(INSPECTION_ACTION_LABELS) as InspectionActionType[]
const DEFAULT_INSPECTION_ACTION: InspectionActionType = INSPECTION_ACTION_TYPES[0] ?? "PASS"

const isInspectionActionType = (value: string | null | undefined): value is InspectionActionType =>
  typeof value === "string" && value in INSPECTION_ACTION_LABELS

const BUNDLE_ALERT_LABELS: Record<string, { label: string; className: string }> = {
  ACTION_REQUIRED: { label: "조치 필요", className: "bg-rose-100 text-rose-700" },
  PENDING_REVIEW: { label: "검토 대기", className: "bg-amber-100 text-amber-700" },
  CLEARED: { label: "정상화", className: "bg-emerald-100 text-emerald-700" },
}

type InspectionActionDraft = {
  localId: string
  actionId?: number | null
  actionType: InspectionActionType
  note: string
  bundleId?: string | null
  targetUserId?: string | null
  roomNumber?: string | null
  personalNo?: number | null
  remove?: boolean
  isNew?: boolean
}

function getErrorCode(error: unknown): string | undefined {
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as ApiErrorLike).code
    return typeof code === "string" ? code : undefined
  }
  return undefined
}

function resolveReallocationErrorMessage(error: unknown): string {
  const fallback =
    error instanceof Error && error.message ? error.message : "재배분 처리 중 오류가 발생했습니다."
  const code = getErrorCode(error)
  if (!code) {
    return fallback
  }
  return getDefaultErrorMessage(code) ?? `${fallback} (${code})`
}

function resolveDeletedBundlesError(error: unknown): string {
  const fallback =
    error instanceof Error && error.message ? error.message : "삭제된 포장 이력을 불러오지 못했습니다."
  const code = getErrorCode(error)
  if (!code) {
    return fallback
  }
  return getDefaultErrorMessage(code) ?? `${fallback} (${code})`
}

function formatInspectionActionLabel(action: InspectionActionType): string {
  return INSPECTION_ACTION_LABELS[action] ?? action
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

function truncateText(value: string | null | undefined, limit: number) {
  if (!value) return ""
  return value.length > limit ? `${value.slice(0, limit)}…` : value
}

function sortRoomLabels(labels: string[]): string[] {
  return [...labels].sort((a, b) => a.localeCompare(b, "ko", { numeric: true, sensitivity: "base" }))
}

function formatRoomLabelList(labels: string[], emptyLabel: string): string {
  const cleaned = labels.map((label) => label.trim()).filter((label) => label.length > 0)
  const sorted = sortRoomLabels(cleaned)
  if (sorted.length === 0) return emptyLabel
  if (sorted.length <= 2) return sorted.join(", ")
  const visible = sorted.slice(0, 2).join(", ")
  const remaining = sorted.length - 2
  return `${visible} 외 ${remaining}칸`
}

type DeletedState = {
  open: boolean
  loading: boolean
  error: string | null
  page: number
  sinceMonths: number
  response: AdminBundleListResponseDto | null
}

type BundleDataState = {
  loading: boolean
  error: string | null
  items: AdminBundleSummary[]
  totalCount: number
}

type ActionShortcut = {
  id: string
  label: string
  description: string
  href?: string
  onClick?: () => void
}

const INITIAL_BUNDLE_DATA: BundleDataState = {
  loading: false,
  error: null,
  items: [],
  totalCount: 0,
}

type InspectionState = {
  loading: boolean
  error: string | null
  items: AdminInspectionSession[]
  status: AdminInspectionSession["status"] | "ALL"
}

type DetailTabValue = "bundles" | "inspections"

type SlotConfigDialogState = {
  open: boolean
  slot: AdminFridgeSlot | null
  status: ResourceStatus
  capacity: string
  saving: boolean
}

export default function AdminFridgePage() {
  const { toast } = useToast()
  const isMobile = useIsMobile()
  const [selectedFloor, setSelectedFloor] = useState<number>(FLOOR_OPTIONS[0]!)
  const [slots, setSlots] = useState<AdminFridgeSlot[]>([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [slotsError, setSlotsError] = useState<string | null>(null)
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null)
  const [slotConfigDialog, setSlotConfigDialog] = useState<SlotConfigDialogState>({
    open: false,
    slot: null,
    status: "ACTIVE",
    capacity: "",
    saving: false,
  })

  const router = useRouter()
  const pathname = usePathname()
  const [bundleData, setBundleData] = useState<BundleDataState>(INITIAL_BUNDLE_DATA)
  const [bundlePage, setBundlePage] = useState(0)
  const [bundleSearch, setBundleSearch] = useState("")
  const [bundleContextKey, setBundleContextKey] = useState("")
  const [bundleSearchInput, setBundleSearchInput] = useState("")
  const [labelReuseLookup, setLabelReuseLookup] = useState<Record<string, string>>({})
  const [slotAlerts, setSlotAlerts] = useState<Record<string, boolean>>({})
  const searchParams = useSearchParams()
  const initialSlotIdRef = useRef<string | null>(searchParams.get("slot") ?? searchParams.get("slotId"))
  const initialOwnerIdRef = useRef<string | null>(searchParams.get("ownerId"))
  const initialBundleIdRef = useRef<string | null>(searchParams.get("bundle") ?? searchParams.get("bundleId"))
  const initialInspectionIdRef = useRef<string | null>(
    searchParams.get("inspectionId") ?? searchParams.get("inspection"),
  )
  const [pendingSlotId, setPendingSlotId] = useState<string | null>(initialSlotIdRef.current)
  const [ownerFilterId, setOwnerFilterId] = useState<string | null>(initialOwnerIdRef.current)
  const [pendingBundleFocusId, setPendingBundleFocusId] = useState<string | null>(initialBundleIdRef.current)
  const [highlightedBundleId, setHighlightedBundleId] = useState<string | null>(initialBundleIdRef.current)
  const [pendingInspectionFocusId, setPendingInspectionFocusId] = useState<string | null>(
    initialInspectionIdRef.current,
  )
  const [highlightedInspectionId, setHighlightedInspectionId] = useState<string | null>(
    initialInspectionIdRef.current,
  )
  const [syncQueryEnabled, setSyncQueryEnabled] = useState(false)
  const [inspectionEditOpen, setInspectionEditOpen] = useState(false)
  const [inspectionDraftActions, setInspectionDraftActions] = useState<InspectionActionDraft[]>([])
  const [inspectionDraftNotes, setInspectionDraftNotes] = useState("")
  const [inspectionEditSubmitting, setInspectionEditSubmitting] = useState(false)
  const [inspectionActionLoading, setInspectionActionLoading] = useState(false)
  const [inspectionReloadToken, setInspectionReloadToken] = useState(0)
  const inspectionOriginalActionsRef = useRef<AdminInspectionActionDetail[]>([])

  useEffect(() => {
    setSyncQueryEnabled(true)
  }, [])

  const updateQueryParams = useCallback(
    (mutator: (params: URLSearchParams) => boolean) => {
      if (!router || !pathname) return
      const params = new URLSearchParams(searchParams.toString())
      const changed = mutator(params)
      if (!changed) return
      const next = params.toString()
      router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false })
    },
    [router, pathname, searchParams],
  )

  useEffect(() => {
    if (!syncQueryEnabled || pendingSlotId !== null) return
    updateQueryParams((params) => {
      if (selectedSlotId) {
        const current = params.get("slot") ?? params.get("slotId")
        if (current === selectedSlotId) return false
        params.set("slot", selectedSlotId)
        params.delete("slotId")
        return true
      }
      let changed = false
      if (params.has("slot")) {
        params.delete("slot")
        changed = true
      }
      if (params.has("slotId")) {
        params.delete("slotId")
        changed = true
      }
      return changed
    })
  }, [selectedSlotId, syncQueryEnabled, pendingSlotId, updateQueryParams])

  useEffect(() => {
    if (!syncQueryEnabled) return
    updateQueryParams((params) => {
      const currentOwner = params.get("ownerId")
      if (ownerFilterId) {
        if (currentOwner === ownerFilterId) return false
        params.set("ownerId", ownerFilterId)
        return true
      }
      if (!currentOwner) return false
      params.delete("ownerId")
      return true
    })
  }, [ownerFilterId, syncQueryEnabled, updateQueryParams])

  const clearQueryKeys = useCallback(
    (keys: string[]) =>
      updateQueryParams((params) => {
        let changed = false
        keys.forEach((key) => {
          if (params.has(key)) {
            params.delete(key)
            changed = true
          }
        })
        return changed
      }),
    [updateQueryParams],
  )

  useEffect(() => {
    const slotParam = searchParams.get("slot") ?? searchParams.get("slotId")
    if (slotParam && slotParam !== selectedSlotId && slotParam !== pendingSlotId) {
      setPendingSlotId(slotParam)
    }

    const ownerParam = searchParams.get("ownerId")
    if (ownerParam !== ownerFilterId) {
      setOwnerFilterId(ownerParam)
    }

    const bundleParam = searchParams.get("bundle") ?? searchParams.get("bundleId")
    if (
      bundleParam &&
      bundleParam !== highlightedBundleId &&
      bundleParam !== pendingBundleFocusId
    ) {
      setPendingBundleFocusId(bundleParam)
      setHighlightedBundleId(bundleParam)
    }

    const inspectionParam = searchParams.get("inspectionId") ?? searchParams.get("inspection")
    if (
      inspectionParam &&
      inspectionParam !== highlightedInspectionId &&
      inspectionParam !== pendingInspectionFocusId
    ) {
      setPendingInspectionFocusId(inspectionParam)
      setHighlightedInspectionId(inspectionParam)
    }
  }, [
    searchParams,
    selectedSlotId,
    pendingSlotId,
    ownerFilterId,
    highlightedBundleId,
    pendingBundleFocusId,
    highlightedInspectionId,
    pendingInspectionFocusId,
  ])

  const resetBundleFilters = useCallback(() => {
    setBundleSearchInput("")
    setBundleSearch("")
    setBundlePage(0)
    setBundleData(INITIAL_BUNDLE_DATA)
  }, [])

  const handleFloorChange = useCallback(
    (floor: number) => {
      if (floor === selectedFloor) return
      resetBundleFilters()
      setSelectedSlotId(null)
      setSelectedFloor(floor)
    },
    [resetBundleFilters, selectedFloor],
  )

  const [inspectionState, setInspectionState] = useState<InspectionState>({
    loading: false,
    error: null,
    items: [],
    status: "SUBMITTED",
  })
  const [selectedInspection, setSelectedInspection] = useState<AdminInspectionSession | null>(null)
  const [inspectionDialogOpen, setInspectionDialogOpen] = useState(false)

  const [deletedState, setDeletedState] = useState<DeletedState>({
    open: false,
    loading: false,
    error: null,
    page: 0,
    sinceMonths: 3,
    response: null,
  })
  const [detailTab, setDetailTab] = useState<DetailTabValue>("inspections")
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false)

  const [reallocationOpen, setReallocationOpen] = useState(false)
  const [reallocationLoading, setReallocationLoading] = useState(false)
  const [reallocationPlan, setReallocationPlan] = useState<AdminReallocationPreviewDto | null>(null)
  const [reallocationSelections, setReallocationSelections] = useState<Record<string, string[]>>({})
  const [reallocationError, setReallocationError] = useState<string | null>(null)
  const [reallocationApplying, setReallocationApplying] = useState(false)

  const selectedSlot = useMemo(
    () => slots.find((slot) => slot.slotId === selectedSlotId) ?? null,
    [slots, selectedSlotId],
  )

  const computedBundleContextKey = useMemo(
    () => `${selectedSlotId ?? ""}|${ownerFilterId ?? ""}`,
    [selectedSlotId, ownerFilterId],
  )

  const previousOwnerFilterRef = useRef<string | null>(ownerFilterId)

  useEffect(() => {
    const previous = previousOwnerFilterRef.current
    if (ownerFilterId && ownerFilterId !== previous) {
      setDetailTab("bundles")
    } else if (!ownerFilterId && previous) {
      setDetailTab("inspections")
    }
    previousOwnerFilterRef.current = ownerFilterId
  }, [ownerFilterId])

  useEffect(() => {
    if (!isMobile) {
      setMobileDetailOpen(false)
    }
  }, [isMobile])

  useEffect(() => {
    if (!selectedSlotId) {
      setMobileDetailOpen(false)
    }
  }, [selectedSlotId])

  const handleSlotSelect = useCallback(
    (slotId: string) => {
      if (slotId === selectedSlotId) {
        if (isMobile) {
          setMobileDetailOpen((prev) => !prev)
        }
        return
      }
      resetBundleFilters()
      setHighlightedBundleId(null)
      setHighlightedInspectionId(null)
      setSelectedSlotId(slotId)
      if (isMobile) {
        setMobileDetailOpen(false)
      }
    },
    [selectedSlotId, resetBundleFilters, isMobile],
  )

  useEffect(() => {
    if (!pendingBundleFocusId) return
    if (bundleData.loading) return
    const match = bundleData.items.find((bundle) => bundle.bundleId === pendingBundleFocusId)
    if (!match) {
      return
    }
    if (selectedSlotId !== match.slotId && match.slotId) {
      handleSlotSelect(match.slotId)
      return
    }
    if (detailTab !== "bundles") {
      setDetailTab("bundles")
    }
    setHighlightedBundleId(match.bundleId)
    setPendingBundleFocusId(null)
    clearQueryKeys(["bundle", "bundleId"])
  }, [
    pendingBundleFocusId,
    bundleData.loading,
    bundleData.items,
    selectedSlotId,
    handleSlotSelect,
    detailTab,
    clearQueryKeys,
  ])

  useEffect(() => {
    if (!pendingInspectionFocusId) return
    if (inspectionState.loading) return
    const match = inspectionState.items.find(
      (inspection) => inspection.sessionId === pendingInspectionFocusId,
    )
    if (!match) {
      return
    }
    if (detailTab !== "inspections") {
      setDetailTab("inspections")
    }
    setHighlightedInspectionId(match.sessionId)
    setPendingInspectionFocusId(null)
    if (match.hasIssue) {
      setSelectedInspection(match)
      setInspectionDialogOpen(true)
    }
    clearQueryKeys(["inspection", "inspectionId"])
  }, [
    pendingInspectionFocusId,
    inspectionState.loading,
    inspectionState.items,
    detailTab,
    clearQueryKeys,
  ])

  const actionShortcuts = useMemo<ActionShortcut[]>(
    () => [
      {
        id: "reallocate",
        label: `${selectedFloor}층 호실 재배분`,
        description: "칸-호실 배정을 재정비하고 잠금/검사 중 칸을 함께 확인합니다.",
        onClick: () => setReallocationOpen(true),
      },
      {
        id: "deleted",
        label: "삭제 이력 확인",
        description: "최근 3개월 내 삭제된 포장을 검토하고 복구 필요 여부를 판단합니다.",
        onClick: () =>
          setDeletedState((prev) => ({
            ...prev,
            open: true,
          })),
      },
      {
        id: "slot-config",
        label: "칸 상태·용량 편집",
        description: "선택된 칸의 상태와 최대 포장 용량을 빠르게 조정합니다.",
        onClick: () => {
          if (!selectedSlot) {
            toast({
              title: "칸을 먼저 선택하세요",
              description: "상태 또는 용량을 수정할 칸을 목록에서 선택해주세요.",
            })
            return
          }
          openSlotConfigDialog(selectedSlot)
        },
      },
    ],
    [selectedFloor, selectedSlot, toast],
  )

  const evaluateSlotAlerts = useCallback(async (slotList: AdminFridgeSlot[]) => {
    if (slotList.length === 0) {
      setSlotAlerts({})
      return
    }
    const results = await Promise.all(
      slotList.map(async (slot: AdminFridgeSlot) => {
        try {
          const sessions = await fetchAdminInspectionSessions({
            slotId: slot.slotId,
            status: "SUBMITTED",
            limit: 3,
          })
          const mapped: AdminInspectionSession[] = sessions.map(mapAdminInspectionSession)
          const hasIssue = mapped.some(
            (session) => session.warningCount > 0 || session.disposalCount > 0,
          )
          return [slot.slotId, hasIssue] as const
        } catch (_error) {
          return [slot.slotId, false] as const
        }
      }),
    )
    const nextAlerts: Record<string, boolean> = {}
    results.forEach(([slotId, hasIssue]) => {
      nextAlerts[slotId] = hasIssue
    })
    setSlotAlerts(nextAlerts)
  }, [])

  const loadSlots = useCallback(
    async (floor: number) => {
      setSlotsLoading(true)
      setSlotsError(null)
      try {
        const response = await fetchAdminCompartments({ floor })
        const mapped: AdminFridgeSlot[] = response.map(mapAdminSlot)
        setSlots(mapped)
        void evaluateSlotAlerts(mapped)

        const pending = pendingSlotId
        const pendingExists = pending && mapped.some((slot) => slot.slotId === pending)
        if (pendingExists) {
          handleSlotSelect(pending)
          setPendingSlotId(null)
          return
        }

        const hasCurrent = mapped.some((slot) => slot.slotId === selectedSlotId)
        if (!hasCurrent) {
          if (pending) {
            if (mapped.length === 0) {
              setSelectedSlotId(null)
            }
          } else {
            const nextSlotId = mapped[0]?.slotId ?? null
            if (nextSlotId) {
              handleSlotSelect(nextSlotId)
            } else {
              setSelectedSlotId(null)
            }
          }
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
    [selectedSlotId, handleSlotSelect, toast, evaluateSlotAlerts, pendingSlotId],
  )

  useEffect(() => {
    void loadSlots(selectedFloor)
  }, [selectedFloor, loadSlots])

  useEffect(() => {
    const targetSlotId = pendingSlotId
    if (!targetSlotId) return
    if (slots.some((slot) => slot.slotId === targetSlotId)) {
      return
    }
    let cancelled = false
    const resolveFloor = async () => {
      for (const floor of FLOOR_OPTIONS) {
        if (floor === selectedFloor) continue
        try {
          const response = await fetchAdminCompartments({ floor })
          if (cancelled) return
          const mapped = response.map(mapAdminSlot)
          const found = mapped.some((slot) => slot.slotId === targetSlotId)
          if (found) {
            setSelectedFloor(floor)
            return
          }
        } catch (error) {
          console.warn("해당 칸의 층 정보를 확인하지 못했습니다.", error)
        }
      }
      if (!cancelled) {
        setPendingSlotId(null)
      }
    }
    void resolveFloor()
    return () => {
      cancelled = true
    }
  }, [pendingSlotId, slots, selectedFloor, setSelectedFloor, setPendingSlotId])

  useEffect(() => {
    const slotId = selectedSlotId
    if (!slotId) return
    let cancelled = false
    const loadLabelReuse = async () => {
      try {
        const sinceISO = subMonths(new Date(), LABEL_REUSE_LOOKBACK_MONTHS).toISOString()
        const response = await fetchAdminDeletedBundles({
          slotId,
          since: sinceISO,
          page: 0,
          size: 200,
        })
        if (cancelled) return
        const prefix = `${slotId}::`
        setLabelReuseLookup((prev) => {
          const next = { ...prev }
          for (const key of Object.keys(next)) {
            if (key.startsWith(prefix)) {
              delete next[key]
            }
          }
          const entries = Array.isArray(response.items)
            ? (response.items as AdminBundleListResponseDto["items"])
            : []
          entries.forEach((item: (typeof entries)[number]) => {
            if (!item) return
            if (item.slotId !== slotId) return
            const bundle = mapAdminBundleSummary(item)
            const label = bundle.labelDisplay
            if (!label) return
            const deletedAt =
              bundle.deletedAt ?? bundle.removedAt ?? bundle.updatedAt ?? null
            next[`${prefix}${label}`] = deletedAt ?? ""
          })
          return next
        })
      } catch (error) {
        if (cancelled) return
        console.error("Failed to evaluate label reuse history", error)
        const prefix = `${slotId}::`
        setLabelReuseLookup((prev) => {
          const next = { ...prev }
          for (const key of Object.keys(next)) {
            if (key.startsWith(prefix)) {
              delete next[key]
            }
          }
          return next
        })
      }
    }

    void loadLabelReuse()

    return () => {
      cancelled = true
    }
  }, [selectedSlotId])

  useEffect(() => {
    if (!selectedSlotId) {
      setBundleData(INITIAL_BUNDLE_DATA)
      return
    }

    if (bundleContextKey !== computedBundleContextKey) {
      setBundleContextKey(computedBundleContextKey)
      setBundlePage(0)
      setBundleData(INITIAL_BUNDLE_DATA)
      return
    }

    setBundleData((prev) => ({ ...prev, loading: true, error: null }))
    const currentOwner = ownerFilterId
    const currentSearch = bundleSearch
    const currentPage = bundlePage
    let active = true
    const load = async () => {
      try {
        const data = await fetchAdminBundleList({
          slotId: selectedSlotId,
          search: currentSearch,
          page: currentPage,
          size: BUNDLE_PAGE_SIZE,
          owner: currentOwner ? undefined : "all",
          ownerUserId: currentOwner ?? undefined,
          status: "active",
        })
        if (!active) return
        setBundleData({
          loading: false,
          error: null,
          items: data.items.map(mapAdminBundleSummary),
          totalCount: data.totalCount ?? data.items.length,
        })
      } catch (error) {
        if (!active) return
        const message =
          error instanceof Error ? error.message : "포장 목록을 불러오는 중 오류가 발생했습니다."
        setBundleData({
          loading: false,
          error: message,
          items: [],
          totalCount: 0,
        })
      }
    }
    void load()
    return () => {
      active = false
    }
  }, [
    selectedSlotId,
    bundleContextKey,
    computedBundleContextKey,
    bundleSearch,
    bundlePage,
    ownerFilterId,
  ])

  useEffect(() => {
    if (!selectedSlotId) return
    setInspectionState((prev) => ({ ...prev, loading: true, error: null }))
    let active = true
    const load = async () => {
      try {
        const statusParam = inspectionState.status === "ALL" ? undefined : inspectionState.status
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
        const status =
          error && typeof error === "object" && "status" in error
            ? (error as { status?: number }).status
            : undefined
        const message =
          status === 503
            ? "검사 기록을 불러오는 중입니다. 잠시 후 다시 시도해 주세요."
            : error instanceof Error
              ? error.message
              : "검사 기록을 불러오는 중 오류가 발생했습니다."
        setInspectionState((prev) => ({
          ...prev,
          loading: false,
          error: message,
          items: [],
        }))
        toast({
          title: "검사 기록을 불러오지 못했습니다.",
          description: message,
          variant: "destructive",
        })
      }
    }
    void load()
    return () => {
      active = false
    }
  }, [selectedSlotId, inspectionState.status, inspectionReloadToken, toast])

  const stats = useMemo(() => {
    if (slots.length === 0) {
      return {
        active: 0,
        locked: 0,
        utilization: null as number | null,
      }
    }
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
    return { active, locked, utilization }
  }, [slots])

  const totalBundlePages = useMemo(
    () => Math.max(1, Math.ceil(bundleData.totalCount / BUNDLE_PAGE_SIZE)),
    [bundleData.totalCount],
  )

  const visibleBundles = useMemo(() => {
    if (!ownerFilterId) return bundleData.items
    return bundleData.items.filter((bundle) => bundle.ownerUserId === ownerFilterId)
  }, [bundleData.items, ownerFilterId])

  const bundleOwnerLookup = useMemo(() => {
    const map = new Map<string, string>()
    bundleData.items.forEach((bundle) => {
      const name = bundle.ownerDisplayName ?? bundle.ownerRoomNumber ?? "사용자"
      map.set(bundle.bundleId, name)
      if (bundle.canonicalId) {
        map.set(bundle.canonicalId, name)
      }
    })
    return map
  }, [bundleData.items])

  const handleSearchSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setBundlePage(0)
    setBundleSearch(bundleSearchInput.trim())
  }

  const handleResetSearch = () => {
    resetBundleFilters()
  }

  const handleDeletedOpenChange = (open: boolean) => {
    setDeletedState((prev) => ({ ...prev, open }))
    if (!open) return
    void loadDeletedBundles(0, deletedState.sinceMonths)
  }

  const loadDeletedBundles = useCallback(async (page: number, months: number) => {
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
      const status =
        error && typeof error === "object" && "status" in error
          ? (error as { status?: number }).status
          : undefined
      const retryMessage =
        status === 503
          ? "서버가 일시적으로 혼잡합니다. 잠시 후 다시 시도해 주세요."
          : resolveDeletedBundlesError(error)
      setDeletedState((prev) => ({
        ...prev,
        loading: false,
        error: retryMessage,
        response: null,
      }))
      toast({
        title: "삭제 이력을 불러올 수 없습니다.",
        description: retryMessage,
        variant: "destructive",
      })
    }
  }, [toast])

  const handleDeletedPageChange = (direction: "prev" | "next") => {
    const nextPage =
      direction === "prev" ? Math.max(0, deletedState.page - 1) : deletedState.page + 1
    void loadDeletedBundles(nextPage, deletedState.sinceMonths)
  }

  const handleDeletedRetry = useCallback(() => {
    void loadDeletedBundles(deletedState.page, deletedState.sinceMonths)
  }, [loadDeletedBundles, deletedState.page, deletedState.sinceMonths])

  const computeUtilization = (capacity?: number | null, occupied?: number | null) => {
    if (typeof capacity !== "number" || capacity <= 0 || typeof occupied !== "number") {
      return null
    }
    return Math.min(1, Math.max(0, occupied / capacity))
  }

  const handleDeletedRangeChange = (value: number) => {
    void loadDeletedBundles(0, value)
  }

  const applyInspectionSessionUpdate = useCallback(
    (dto: AdminInspectionSessionDto) => {
      const mapped = mapAdminInspectionSession(dto)
      setInspectionState((prev) => ({
        ...prev,
        items: prev.items.map((item) => (item.sessionId === mapped.sessionId ? mapped : item)),
      }))
      setSelectedInspection(mapped)
      setSlotAlerts((prev) => ({
        ...prev,
        [mapped.slotId]: mapped.hasIssue,
      }))
      return mapped
    },
    [setInspectionState, setSelectedInspection, setSlotAlerts],
  )

  const createActionDraft = useCallback(
    (action: AdminInspectionActionDetail, index: number): InspectionActionDraft => ({
      localId: `existing-${action.actionId ?? index}`,
      actionId: action.actionId ?? null,
      actionType: isInspectionActionType(action.actionType)
        ? action.actionType
        : DEFAULT_INSPECTION_ACTION,
      note: action.note ?? "",
      bundleId: action.bundleId ?? null,
      targetUserId: action.targetUserId ?? null,
      roomNumber: action.roomNumber ?? null,
      personalNo: action.personalNo ?? null,
      remove: false,
      isNew: false,
    }),
    [],
  )

  const handleInspectionRowClick = useCallback((inspection: AdminInspectionSession) => {
    if (!inspection.hasIssue) return
    setHighlightedInspectionId(inspection.sessionId)
    setSelectedInspection(inspection)
    setInspectionDialogOpen(true)
  }, [])

  const closeInspectionDialog = useCallback(() => {
    setInspectionDialogOpen(false)
    setSelectedInspection(null)
  }, [])

  const handleInspectionAdjust = useCallback(() => {
    if (!selectedInspection) return
    inspectionOriginalActionsRef.current = selectedInspection.actions
    setInspectionDraftNotes(selectedInspection.notes ?? "")
    if (selectedInspection.actions.length > 0) {
      setInspectionDraftActions(
        selectedInspection.actions.map((action, index) => createActionDraft(action, index)),
      )
    } else {
      const localId =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `new-${Date.now()}`
      setInspectionDraftActions([
        {
          localId,
          actionId: null,
          actionType: DEFAULT_INSPECTION_ACTION,
          note: "",
          bundleId: null,
          targetUserId: null,
          remove: false,
          isNew: true,
        },
      ])
    }
    setInspectionEditOpen(true)
  }, [createActionDraft, selectedInspection])

  const handleInspectionResend = useCallback(async () => {
    if (!selectedInspection) return
    try {
      setInspectionActionLoading(true)
      const updated = await resendInspectionNotification(selectedInspection.sessionId)
      applyInspectionSessionUpdate(updated)
      toast({
        title: "검사 결과 알림을 재발송했습니다.",
        description: "사용자에게 최신 검사 결과 알림을 다시 전송했습니다.",
      })
    } catch (error) {
      const message =
        error && typeof error === "object" && "message" in error && typeof error.message === "string"
          ? (error as { message: string }).message
          : "알림 재발송 중 문제가 발생했습니다."
      toast({
        title: "알림 재발송 실패",
        description: message,
        variant: "destructive",
      })
    } finally {
      setInspectionActionLoading(false)
    }
  }, [applyInspectionSessionUpdate, selectedInspection, toast])

  const handleInspectionRequestReinspection = useCallback(async () => {
    if (!selectedInspection) return
    try {
      setInspectionActionLoading(true)
      const schedule = await requestInspectionReinspection(selectedInspection.sessionId)
      toast({
        title: "재검 일정을 생성했습니다.",
        description: schedule.scheduledAt
          ? `${formatDateTime(schedule.scheduledAt, "-")} 예정`
          : "재검 일정이 생성되었습니다.",
      })
    } catch (error) {
      const message =
        error && typeof error === "object" && "message" in error && typeof error.message === "string"
          ? (error as { message: string }).message
          : "재검 일정을 생성하지 못했습니다."
      toast({
        title: "재검 요청 실패",
        description: message,
        variant: "destructive",
      })
    } finally {
      setInspectionActionLoading(false)
    }
  }, [selectedInspection, toast])

  const handleInspectionRetry = useCallback(() => {
    setInspectionState((prev) => ({ ...prev, loading: true }))
    setInspectionReloadToken((token) => token + 1)
  }, [])

  const updateDraftAction = useCallback(
    (localId: string, updates: Partial<InspectionActionDraft>) => {
      setInspectionDraftActions((prev) =>
        prev.map((draft) => (draft.localId === localId ? { ...draft, ...updates } : draft)),
      )
    },
    [],
  )

  const handleAddDraftAction = useCallback(() => {
    const localId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `new-${Date.now()}`
    setInspectionDraftActions((prev) => [
      ...prev,
      {
        localId,
        actionId: null,
        actionType: DEFAULT_INSPECTION_ACTION,
        note: "",
        bundleId: null,
        targetUserId: null,
        remove: false,
        isNew: true,
      },
    ])
  }, [])

  const handleToggleRemoveDraftAction = useCallback((localId: string) => {
    setInspectionDraftActions((prev) => {
      const target = prev.find((draft) => draft.localId === localId)
      if (!target) return prev
      if (target.isNew) {
        return prev.filter((draft) => draft.localId !== localId)
      }
      return prev.map((draft) =>
        draft.localId === localId ? { ...draft, remove: !draft.remove } : draft,
      )
    })
  }, [])

  const resetInspectionDraft = useCallback(() => {
    setInspectionDraftActions([])
    setInspectionDraftNotes("")
    inspectionOriginalActionsRef.current = []
  }, [])

  const handleInspectionAdjustSubmit = useCallback(async () => {
    if (!selectedInspection) return
    const originalActions = inspectionOriginalActionsRef.current
    const originalMap = new Map<number, AdminInspectionActionDetail>()
    originalActions.forEach((action) => {
      if (action.actionId != null) {
        originalMap.set(action.actionId, action)
      }
    })
    const trimmedNotes = inspectionDraftNotes.trim()
    const originalNotes = (selectedInspection.notes ?? "").trim()
    const noteChanged = trimmedNotes !== originalNotes

    const deleteActionIds = inspectionDraftActions
      .filter((draft) => draft.remove && draft.actionId != null)
      .map((draft) => draft.actionId as number)

    const mutations = inspectionDraftActions
      .filter((draft) => !draft.remove)
      .filter((draft) => {
        if (draft.actionId == null) {
          return true
        }
        const original = originalMap.get(draft.actionId)
        if (!original) return true
        const originalAction = isInspectionActionType(original.actionType)
          ? original.actionType
          : DEFAULT_INSPECTION_ACTION
        const originalNote = (original.note ?? "").trim()
        const draftNote = draft.note.trim()
        return originalAction !== draft.actionType || originalNote !== draftNote
      })
      .map((draft) => ({
        actionId: draft.actionId ?? null,
        action: draft.actionType,
        bundleId: draft.bundleId ?? null,
        itemId: null,
        note: draft.note.trim().length > 0 ? draft.note.trim() : null,
      }))

    if (!noteChanged && mutations.length === 0 && deleteActionIds.length === 0) {
      toast({
        title: "반영할 변경 사항이 없습니다.",
        description: "조치를 수정하거나 삭제 후 다시 저장해 주세요.",
      })
      return
    }

    const payload: AdminUpdateInspectionSessionRequestDto = {}
    if (noteChanged) {
      payload.notes = trimmedNotes.length > 0 ? trimmedNotes : null
    }
    if (mutations.length > 0) {
      payload.mutations = mutations
    }
    if (deleteActionIds.length > 0) {
      payload.deleteActionIds = deleteActionIds
    }

    try {
      setInspectionEditSubmitting(true)
      const updated = await updateAdminInspectionSession(selectedInspection.sessionId, payload)
      const mapped = applyInspectionSessionUpdate(updated)
      toast({
        title: "검사 내용을 정정했습니다.",
        description: mapped.notes
          ? "정정된 내용이 저장되었으며 감사 로그에 기록되었습니다."
          : "정정된 내용이 저장되었습니다.",
      })
      setInspectionEditOpen(false)
      resetInspectionDraft()
    } catch (error) {
      const message =
        error && typeof error === "object" && "message" in error && typeof error.message === "string"
          ? (error as { message: string }).message
          : "검사 정정 중 오류가 발생했습니다."
      toast({
        title: "검사 정정 실패",
        description: message,
        variant: "destructive",
      })
    } finally {
      setInspectionEditSubmitting(false)
    }
  }, [
    applyInspectionSessionUpdate,
    inspectionDraftActions,
    inspectionDraftNotes,
    selectedInspection,
    toast,
    resetInspectionDraft,
  ])

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
    if (!reallocationPlan) return
    const allocation = reallocationPlan.allocations.find(
      (item) => item.compartmentId === compartmentId,
    )
    if (!allocation) return
    setReallocationSelections((prev) => ({
      ...prev,
      [compartmentId]: [...allocation.recommendedRoomIds],
    }))
  }

  const openSlotConfigDialog = (slot: AdminFridgeSlot) => {
    setSlotConfigDialog({
      open: true,
      slot,
      status: slot.resourceStatus,
      capacity:
        typeof slot.capacity === "number" && slot.capacity > 0 ? String(slot.capacity) : "",
      saving: false,
    })
  }

  const resetSlotConfigDialog = () => {
    setSlotConfigDialog({
      open: false,
      slot: null,
      status: "ACTIVE",
      capacity: "",
      saving: false,
    })
  }

  const slotConfigHasChanges = useMemo(() => {
    const target = slotConfigDialog.slot
    if (!target) return false
    const trimmed = slotConfigDialog.capacity.trim()
    const parsed =
      trimmed.length > 0 && !Number.isNaN(Number(trimmed)) ? Number(trimmed) : undefined
    const currentCapacity =
      typeof target.capacity === "number" ? target.capacity : undefined
    const capacityChanged =
      parsed !== undefined ? parsed !== currentCapacity : false
    const statusChanged = slotConfigDialog.status !== target.resourceStatus
    return capacityChanged || statusChanged
  }, [slotConfigDialog])

  const handleSlotConfigSubmit = async () => {
    const target = slotConfigDialog.slot
    if (!target) return

    const trimmed = slotConfigDialog.capacity.trim()
    const parsedCapacity =
      trimmed.length > 0 ? Number(trimmed) : undefined

    if (parsedCapacity !== undefined && (Number.isNaN(parsedCapacity) || parsedCapacity <= 0)) {
      toast({
        title: "용량을 확인하세요",
        description: "칸 용량은 1 이상의 숫자로 입력해야 합니다.",
        variant: "destructive",
      })
      return
    }

    const payload: Partial<UpdateCompartmentConfigPayload> = {}
    if (slotConfigDialog.status !== target.resourceStatus) {
      payload.status = slotConfigDialog.status
    }
    const currentCapacity =
      typeof target.capacity === "number" ? target.capacity : undefined
    if (parsedCapacity !== undefined && parsedCapacity !== currentCapacity) {
      payload.maxBundleCount = parsedCapacity
    }

    if (Object.keys(payload).length === 0) {
      toast({
        title: "변경 사항이 없습니다",
        description: "상태 또는 용량을 수정한 뒤 저장을 눌러주세요.",
      })
      return
    }

    setSlotConfigDialog((prev) => ({ ...prev, saving: true }))
    try {
      const updated = await updateFridgeCompartment(target.slotId, payload)
      setSlots((prev) =>
        prev.map((slot) => {
          if (slot.slotId !== updated.slotId) return slot
          const capacity =
            typeof updated.capacity === "number" ? updated.capacity : slot.capacity ?? null
          const occupied =
            typeof updated.occupiedCount === "number"
              ? updated.occupiedCount
              : slot.occupiedCount ?? null
          return {
            ...slot,
            resourceStatus: updated.resourceStatus,
            capacity,
            locked: updated.locked,
            lockedUntil: updated.lockedUntil ?? null,
            displayName: updated.displayName ?? slot.displayName,
            occupiedCount: occupied,
            utilization: computeUtilization(capacity, occupied),
          }
        }),
      )
      toast({
        title: "칸 설정이 저장되었습니다",
        description: `${
          updated.displayName ??
          target.displayName ??
          `${target.floorNo}F ${target.slotLetter ?? ""}`
        } 설정을 갱신했습니다.`,
      })
      resetSlotConfigDialog()
    } catch (error) {
      toast({
        title: "칸 설정 저장 실패",
        description: error instanceof Error ? error.message : "잠시 후 다시 시도해주세요.",
        variant: "destructive",
      })
      setSlotConfigDialog((prev) => ({ ...prev, saving: false }))
    }
  }

  const renderSlotCard = (slot: AdminFridgeSlot) => {
    const badge = STATUS_BADGE[slot.resourceStatus]
    const isSelected = slot.slotId === selectedSlotId
    const utilization =
      typeof slot.utilization === "number" ? Math.round(slot.utilization * 100) : null
    const isConfigSaving =
      slotConfigDialog.saving && slotConfigDialog.slot?.slotId === slot.slotId
    const hasAttention = slotAlerts[slot.slotId] === true

    return (
      <div
        key={slot.slotId}
        role="button"
        tabIndex={0}
        aria-pressed={isSelected}
        onClick={() => handleSlotSelect(slot.slotId)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault()
            handleSlotSelect(slot.slotId)
          }
        }}
        className={cn(
          "flex h-full w-full max-w-full flex-col cursor-pointer rounded-2xl border bg-white p-4 text-left shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 xl:max-w-[540px]",
          isSelected
            ? "border-emerald-400 ring-1 ring-emerald-200"
            : "border-slate-200 hover:border-emerald-200 hover:shadow-md",
        )}
       >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">
              {slot.displayName ?? `${slot.floorNo}F · ${slot.slotLetter}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {hasAttention ? (
              <Badge className="bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700">
                조치 필요
              </Badge>
            ) : null}
            {badge ? <Badge className={badge.className}>{badge.label}</Badge> : null}
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
            <Button
              variant="outline"
              size="sm"
              className="h-8 min-w-[132px]"
              onClick={(event) => {
                event.stopPropagation()
                if (isConfigSaving) return
                openSlotConfigDialog(slot)
              }}
              onKeyDown={(event) => event.stopPropagation()}
              disabled={isConfigSaving}
            >
              {isConfigSaving ? (
                <>
                  <Loader2 className="size-3 animate-spin" aria-hidden />
                  적용 중
                </>
              ) : (
                <>
                  <Settings2 className="size-3.5" aria-hidden />
                  상태·설정
                </>
              )}
            </Button>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <div className="flex items-baseline gap-1 text-lg font-semibold text-slate-900">
            <span>{typeof slot.occupiedCount === "number" ? slot.occupiedCount : "-"}</span>
            <span className="text-sm font-medium text-slate-400">
              /{typeof slot.capacity === "number" ? slot.capacity : "-"}
            </span>
          </div>
          {utilization !== null ? (
            <div className="flex min-w-[160px] flex-1 items-center gap-2">
              <Progress value={utilization} className="h-1.5 flex-1" />
              <span className="text-xs font-semibold text-emerald-600">{utilization}%</span>
            </div>
          ) : (
            <span className="text-xs text-slate-400">용량 정보 없음</span>
          )}
        </div>
        <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
          <span>마지막 갱신 {formatRelative(slot.lockedUntil) || "-"}</span>
          {isMobile ? (
            isSelected ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-3 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                onClick={(event) => {
                  event.stopPropagation()
                  setMobileDetailOpen(true)
                }}
                onKeyDown={(event) => event.stopPropagation()}
                aria-label="선택된 칸 상세 열기"
              >
                상세 열기
                <ArrowRight className="size-3.5" aria-hidden />
              </Button>
            ) : (
              <span className="font-medium text-emerald-600">탭하여 선택</span>
            )
          ) : isSelected ? (
            <Badge className="bg-emerald-100 px-2 py-0.5 text-[11px] text-emerald-700">선택됨</Badge>
          ) : (
            <span className="font-medium text-emerald-600">상세 보기</span>
          )}
        </div>
      </div>
    )
  }

  const renderSlotList = (containerClassName: string): JSX.Element => {
    if (slotsLoading) {
      return (
        <div className="flex items-center justify-center rounded-lg border border-dashed border-emerald-200 bg-emerald-50/40 py-12 text-sm text-emerald-700">
          <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
          칸 정보를 불러오는 중입니다…
        </div>
      )
    }

    if (slotsError) {
      return (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-600">
          {slotsError}
        </div>
      )
    }

    if (slots.length === 0) {
      return (
        <div className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
          선택한 층에 표시할 칸이 없습니다.
        </div>
      )
    }

    return <div className={containerClassName}>{slots.map((slot) => renderSlotCard(slot))}</div>
  }

  const detailSection = (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-900">상세</h2>
        {selectedSlot ? (
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <Badge
                variant="outline"
                className="border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-semibold text-slate-600"
              >
                {selectedSlot.displayName ?? `${selectedSlot.floorNo}F ${selectedSlot.slotLetter}`}
              </Badge>
              <span>{selectedSlot.compartmentType}</span>
              <span className="text-slate-300">·</span>
              <span>인덱스 {selectedSlot.slotIndex}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-1"
                onClick={() => openSlotConfigDialog(selectedSlot)}
              >
                <Settings2 className="size-4" aria-hidden />
                상태·설정
              </Button>
              {detailTab === "bundles" ? (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1 text-slate-600 hover:text-emerald-600"
                    onClick={handleResetSearch}
                    disabled={bundleData.loading}
                  >
                    <RotateCcw className="size-4" aria-hidden />
                    검색 초기화
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1"
                    onClick={() => handleDeletedOpenChange(true)}
                  >
                    <History className="size-4" aria-hidden />
                    삭제 이력
                  </Button>
                </>
              ) : null}
              <Button variant="ghost" size="sm" className="gap-1 text-emerald-600" asChild>
                <Link href={`/admin/audit?module=fridge&slotId=${selectedSlot.slotId}`}>
                  감사 로그 이동
                  <ArrowRight className="size-3" aria-hidden />
                </Link>
              </Button>
            </div>
          </div>
        ) : null}
      </div>
      {selectedSlot ? (
        <Tabs
          value={detailTab}
          onValueChange={(value) => setDetailTab(value as DetailTabValue)}
          className="space-y-4"
        >
          <TabsList className="sticky top-0 z-20 w-full justify-start gap-2 rounded-xl border border-slate-200 bg-white/90 p-1 shadow-sm backdrop-blur lg:top-3">
            <TabsTrigger
              value="inspections"
              className="flex-none rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 transition data-[state=active]:bg-emerald-100 data-[state=active]:text-emerald-700"
            >
              검사 기록
            </TabsTrigger>
            <TabsTrigger
              value="bundles"
              className="flex-none rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 transition data-[state=active]:bg-emerald-100 data-[state=active]:text-emerald-700"
            >
              포장 목록
            </TabsTrigger>
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
              </div>
            </form>
            <div className="text-xs text-slate-500 sm:text-right">
              {ownerFilterId ? (
                <span>
                  필터 결과 {visibleBundles.length.toLocaleString()}건 · 전체 {bundleData.totalCount.toLocaleString()}건
                </span>
              ) : (
                <span>
                  총 {bundleData.totalCount.toLocaleString()}건 · 페이지 {bundlePage + 1}/{totalBundlePages}
                </span>
              )}
            </div>
            {ownerFilterId ? (
              <div className="flex items-center justify-between gap-2 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                <span>선택한 사용자의 포장만 표시 중입니다.</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-emerald-700"
                  onClick={() => {
                    setOwnerFilterId(null)
                    setHighlightedBundleId(null)
                  }}
                >
                  필터 해제
                </Button>
              </div>
            ) : null}
            <div className="rounded-lg border border-slate-200">
              {bundleData.loading ? (
                <div className="flex items-center justify-center py-12 text-sm text-slate-500">
                  <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                  포장 목록을 불러오는 중입니다…
                </div>
              ) : bundleData.error ? (
                <div className="p-4 text-sm text-rose-600">{bundleData.error}</div>
              ) : visibleBundles.length === 0 ? (
                <div className="p-4 text-sm text-slate-500">
                  조건에 맞는 포장이 없습니다. 검색어와 필터를 조정해 보세요.
                </div>
              ) : (
                <div className="max-h-[360px] overflow-auto">
                  <Table className="min-w-[640px] table-fixed">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[120px] px-2 text-xs font-semibold text-slate-500">
                          라벨 · 포장명
                        </TableHead>
                        <TableHead className="w-[140px] px-2 text-xs font-semibold text-slate-500">
                          소유자
                        </TableHead>
                        <TableHead className="w-[80px] px-2 text-xs font-semibold text-slate-500">
                          물품 수
                        </TableHead>
                        <TableHead className="px-2 text-xs font-semibold text-slate-500">
                          최근 검사 요약
                        </TableHead>
                        <TableHead className="w-[96px] px-2 text-right text-xs font-semibold text-slate-500">
                          
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visibleBundles.map((bundle) => {
                        const freshnessBadge = formatFreshness(bundle.freshness)
                        const bundleNameDisplay = truncateText(bundle.bundleName, 11)
                        const ownerDisplay = truncateText(bundle.ownerDisplayName ?? "-", 6)
                        const warningCount = bundle.warningCount ?? 0
                        const disposalCount = bundle.disposalCount ?? 0
                        const lastInspectionText = bundle.lastInspectionAt
                          ? formatDateTime(bundle.lastInspectionAt, "-")
                          : "검사 기록 없음"
                        const alertBadge = bundle.alertState
                          ? BUNDLE_ALERT_LABELS[bundle.alertState] ?? {
                              label: bundle.alertState,
                              className: "bg-amber-100 text-amber-700",
                            }
                          : null
                        const hasInspection = Boolean(bundle.lastInspectionId)
                        return (
                          <TableRow
                            key={bundle.bundleId}
                            className={cn(
                              "transition hover:bg-slate-50",
                              bundle.bundleId === highlightedBundleId
                                ? "bg-emerald-50/80 ring-1 ring-emerald-200"
                                : undefined,
                            )}
                            onClick={() => {
                              setHighlightedBundleId(bundle.bundleId)
                              setDetailTab("inspections")
                              if (bundle.lastInspectionId) {
                                setPendingInspectionFocusId(bundle.lastInspectionId)
                              } else {
                                toast({
                                  title: "검사 기록 없음",
                                  description: "이 포장에 대한 검사 기록이 아직 없습니다.",
                                })
                              }
                            }}
                          >
                            <TableCell className="px-2 py-2 align-top">
                              <div className="text-sm font-semibold text-slate-900">{bundle.labelDisplay}</div>
                              <div className="max-w-[200px] truncate text-xs text-slate-500" title={bundle.bundleName}>
                                {bundleNameDisplay}
                              </div>
                            </TableCell>
                            <TableCell className="px-2 py-2 align-top text-sm text-slate-700">
                              {bundle.ownerUserId ? (
                                <Link
                                  href={`/admin/users?focus=${bundle.ownerUserId}`}
                                  className="text-emerald-600 hover:underline"
                                  onClick={(event) => event.stopPropagation()}
                                >
                                  {ownerDisplay}
                                </Link>
                              ) : (
                                <span>{ownerDisplay}</span>
                              )}
                              <p className="text-xs text-slate-500">
                                {bundle.ownerRoomNumber ?? "호실 정보 없음"}
                              </p>
                            </TableCell>
                            <TableCell className="px-2 py-2 align-top text-sm font-semibold text-slate-900">
                              {bundle.itemCount.toLocaleString()}개
                            </TableCell>
                            <TableCell className="px-2 py-2 align-top text-xs text-slate-600">
                              {freshnessBadge ? (
                                <Badge className={cn("mr-2 inline-flex items-center gap-1 px-2 py-0.5 text-xs", freshnessBadge.className)}>
                                  {freshnessBadge.label}
                                </Badge>
                              ) : null}
                              {alertBadge ? (
                                <Badge className={cn("mr-2 inline-flex items-center px-2 py-0.5 text-xs", alertBadge.className)}>
                                  {alertBadge.label}
                                </Badge>
                              ) : null}
                              <div className="mt-1 flex flex-wrap items-center gap-3">
                                <span className="inline-flex items-center gap-1 text-amber-600">
                                  <AlertTriangle className="size-3" aria-hidden />
                                  경고 {warningCount}
                                </span>
                                <span className="inline-flex items-center gap-1 text-rose-600">
                                  <AlertCircle className="size-3" aria-hidden />
                                  폐기 {disposalCount}
                                </span>
                              </div>
                              <div className="mt-1 text-[11px] text-slate-500">{lastInspectionText}</div>
                            </TableCell>
                            <TableCell className="px-2 py-2 text-right align-top">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-7 gap-1 text-slate-600"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  toast({
                                    title: hasInspection ? "포장 상세 준비 중" : "포장 상세 준비 중",
                                    description: "물품 구성 및 라벨 히스토리는 후속 업데이트에서 제공됩니다.",
                                  })
                                }}
                              >
                                상세 열기
                                <ArrowRight className="size-3" aria-hidden />
                              </Button>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
            <div className="flex items-center justify-between text-xs text-slate-500">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setBundlePage((prev) => Math.max(0, prev - 1))}
                  disabled={bundlePage === 0 || bundleData.loading}
                >
                  이전
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setBundlePage((prev) => Math.min(totalBundlePages - 1, prev + 1))}
                  disabled={bundlePage >= totalBundlePages - 1 || bundleData.loading}
                >
                  다음
                </Button>
              </div>
              <span>
                {bundlePage + 1} / {totalBundlePages} 페이지
              </span>
            </div>
          </TabsContent>
          <TabsContent value="inspections" className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-2">
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
                <div className="flex flex-col gap-3 p-4 text-sm text-rose-600">
                  <p>{inspectionState.error}</p>
                  <div>
                    <Button variant="outline" size="sm" onClick={handleInspectionRetry}>
                      다시 시도
                    </Button>
                  </div>
                </div>
              ) : inspectionState.items.length === 0 ? (
                <div className="p-4 text-sm text-slate-500">
                  선택한 조건에 해당하는 검사 기록이 없습니다.
                </div>
              ) : (
                <div className="max-h-[360px] overflow-auto">
                  <Table className="min-w-[720px] table-fixed">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[180px] px-3 text-xs font-semibold text-slate-500">
                          검사일 · 검사자
                        </TableHead>
                        <TableHead className="w-[96px] px-3 text-xs font-semibold text-slate-500">
                          상태
                        </TableHead>
                        <TableHead className="px-3 text-xs font-semibold text-slate-500">
                          조치 요약
                        </TableHead>
                        <TableHead className="w-[160px] px-3 text-xs font-semibold text-slate-500">
                          벌점 · 알림 결과
                        </TableHead>
                        <TableHead className="w-[120px] px-3 text-xs font-semibold text-slate-500">
                          관리자 확인
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {inspectionState.items.map((inspection) => {
                        const penaltyText =
                          inspection.disposalCount > 0
                            ? `벌점 ${inspection.disposalCount}건`
                            : "벌점 없음"
                        const notificationText = "알림 -"
                        const hasIssue = inspection.hasIssue

                        return (
                          <TableRow
                            key={inspection.sessionId}
                            onClick={() => {
                              if (!hasIssue) return
                              handleInspectionRowClick(inspection)
                            }}
                            className={cn(
                              "cursor-default transition",
                              hasIssue ? "cursor-pointer hover:bg-emerald-50" : "opacity-90",
                              inspection.sessionId === highlightedInspectionId
                                ? "bg-emerald-50/80 ring-1 ring-emerald-200"
                                : undefined,
                            )}
                          >
                            <TableCell className="px-3 py-3 align-top text-sm text-slate-900">
                              <div className="font-semibold">{formatDateTime(inspection.startedAt, "-")}</div>
                              <div className="text-xs text-slate-500">
                                검사자 {formatInspectorDisplay(inspection)}
                              </div>
                            </TableCell>
                            <TableCell className="px-3 py-3 align-top">
                              <Badge variant="outline" className="border-slate-200 text-slate-600">
                                {INSPECTION_STATUS_LABEL[inspection.status]}
                              </Badge>
                            </TableCell>
                            <TableCell className="px-3 py-3 align-top text-xs text-slate-600">
                              <div className="flex flex-wrap gap-2">
                                <span className="inline-flex items-center gap-1">
                                  <AlertTriangle className="size-3 text-amber-500" aria-hidden />
                                  경고 {inspection.warningCount}
                                </span>
                                <span className="inline-flex items-center gap-1">
                                  <AlertCircle className="size-3 text-rose-500" aria-hidden />
                                  폐기 {inspection.disposalCount}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="px-3 py-3 align-top text-xs text-slate-600">
                              <div>{penaltyText}</div>
                              <div>{notificationText}</div>
                            </TableCell>
                            <TableCell className="px-3 py-3 align-top">
                              <Badge
                                className={cn(
                                  "px-3 py-0.5 text-xs font-semibold",
                                  hasIssue ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-600",
                                )}
                              >
                                {hasIssue ? "조치 필요" : "정상"}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
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
  )

  const handleReallocationOpenChange = (open: boolean) => {
    setReallocationOpen(open)
    if (!open) {
      setReallocationPlan(null)
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
        const plan = await previewReallocation(selectedFloor)
        if (!active) return
        setReallocationPlan(plan)
        const initialSelections: Record<string, string[]> = {}
        plan.allocations.forEach((allocation) => {
          initialSelections[allocation.compartmentId] = [...allocation.recommendedRoomIds]
        })
        setReallocationSelections(initialSelections)
      } catch (error) {
        if (!active) return
        const message = resolveReallocationErrorMessage(error)
        setReallocationError(message)
        toast({
          title: "호실 재배분 정보를 불러오지 못했습니다.",
          description: message,
          variant: "destructive",
        })
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
    if (!reallocationPlan || !selectedFloor) return
    setReallocationApplying(true)
    try {
      const payload = {
        floor: selectedFloor,
        allocations: reallocationPlan.allocations.map((allocation) => ({
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
      setReallocationPlan(null)
      setReallocationSelections({})
      await loadSlots(selectedFloor)
    } catch (error) {
      const message = resolveReallocationErrorMessage(error)
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
    if (!reallocationPlan) return new Map<string, string>()
    const map = new Map<string, string>()
    reallocationPlan.rooms.forEach((room) => {
      map.set(room.roomId, room.roomNumber)
    })
    return map
  }, [reallocationPlan])

  return (
    <Fragment>
      <div data-admin-slot="main" className="space-y-6">
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
        </div>
        <div className="flex flex-col gap-4 rounded-2xl border border-emerald-100 bg-white/80 p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
            <div className="space-y-2">
              <Label htmlFor="admin-floor-select" className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                층 선택
              </Label>
              <Select
                value={String(selectedFloor)}
                onValueChange={(value) => {
                  const parsed = Number(value)
                  handleFloorChange(Number.isNaN(parsed) ? FLOOR_OPTIONS[0]! : parsed)
                }}
              >
                <SelectTrigger
                  id="admin-floor-select"
                  className="h-12 w-[200px] rounded-xl border-2 border-emerald-200 bg-emerald-50/60 px-4 font-semibold text-emerald-700 shadow-sm transition hover:border-emerald-300 focus:border-emerald-400 focus:ring-emerald-400"
                >
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
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
              <Badge variant="outline" className="border-emerald-200 bg-white/90 text-emerald-700">
                운영 중 {stats.active}칸
              </Badge>
              <Badge variant="outline" className="border-amber-200 bg-white/90 text-amber-700">
                잠금 {stats.locked}칸
              </Badge>
              {typeof stats.utilization === "number" ? (
                <Badge variant="outline" className="border-slate-200 bg-white/90 text-slate-600">
                  평균 활용률 {stats.utilization}%
                </Badge>
              ) : null}
            </div>
          </div>
      <Dialog
        open={inspectionDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            closeInspectionDialog()
          }
        }}
      >
        <DialogContent className="max-w-3xl">
          {selectedInspection ? (
            <>
              <DialogHeader>
                <DialogTitle>검사 상세</DialogTitle>
                <DialogDescription>
                  {formatDateTime(selectedInspection.startedAt, "-")} · 검사자 {formatInspectorDisplay(selectedInspection)}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 text-sm text-slate-600">
                <section className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="border-slate-200 text-slate-600">
                    {INSPECTION_STATUS_LABEL[selectedInspection.status]}
                  </Badge>
                  <Badge className="bg-emerald-100 px-3 py-0.5 text-xs font-semibold text-emerald-700">
                    경고 {selectedInspection.warningCount}
                  </Badge>
                  <Badge className="bg-rose-100 px-3 py-0.5 text-xs font-semibold text-rose-700">
                    폐기 {selectedInspection.disposalCount}
                  </Badge>
                </section>
                {selectedInspection.notes ? (
                  <section className="space-y-2">
                    <h3 className="text-sm font-semibold text-slate-900">검사 메모</h3>
                    <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
                      {selectedInspection.notes}
                    </p>
                  </section>
                ) : null}
                <section className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-900">조치 타임라인</h3>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleInspectionAdjust}
                      disabled={inspectionEditSubmitting || inspectionActionLoading}
                    >
                      정정
                    </Button>
                  </div>
                  {selectedInspection.actions.length === 0 ? (
                    <p className="text-xs text-slate-500">기록된 조치가 없습니다.</p>
                  ) : (
                    <ScrollArea className="max-h-[260px] pr-2">
                      <div className="space-y-1">
                        {selectedInspection.actions.map((action, index) => {
                          const key =
                            action.actionId ??
                            action.correlationId ??
                            `${action.recordedAt ?? "action"}-${index}`
                          const actionType = isInspectionActionType(action.actionType)
                            ? action.actionType
                            : DEFAULT_INSPECTION_ACTION
                          const actionLabel = formatInspectionActionLabel(actionType)
                          const recordedAt = action.recordedAt
                            ? formatDateTime(action.recordedAt, "-")
                            : "기록 시간 미상"
                          const notificationLabel =
                            action.notificationStatus && INSPECTION_NOTIFICATION_LABELS[action.notificationStatus]
                              ? INSPECTION_NOTIFICATION_LABELS[action.notificationStatus]
                              : action.notificationStatus ?? null
                          const trimmedNote = action.note?.trim()
                          const bundleCount = action.items.length
                          const actionBadgeClass =
                            actionType === "DISPOSE_EXPIRED" || actionType === "UNREGISTERED_DISPOSE"
                              ? "border-rose-200 text-rose-700 bg-rose-50"
                              : actionType.startsWith("WARN")
                                ? "border-amber-200 text-amber-700 bg-amber-50"
                                : "border-slate-200 text-slate-600 bg-slate-50"
                          const roomLabel = action.roomNumber ?? undefined
                          const personalLabel =
                            typeof action.personalNo === "number" ? String(action.personalNo) : undefined
                          const roomPersonal =
                            roomLabel && personalLabel
                              ? `${roomLabel} - ${personalLabel}`
                              : roomLabel || personalLabel || undefined
                          const ownerName = action.bundleId
                            ? bundleOwnerLookup.get(action.bundleId) ?? "사용자"
                            : "사용자"
                          return (
                            <div
                              key={key}
                              className="flex flex-wrap items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-600"
                            >
                              <Badge
                                variant="outline"
                                className={cn(
                                  "px-2 py-0.5 text-xs font-semibold",
                                  actionBadgeClass,
                                )}
                              >
                                {actionLabel}
                              </Badge>
                              {roomPersonal ? <span>{roomPersonal}</span> : null}
                              {action.targetUserId ? (
                                <Link
                                  href={`/admin/users?focus=${action.targetUserId}`}
                                  className="text-emerald-600 hover:underline"
                                >
                                  {ownerName}
                                </Link>
                              ) : null}
                              {bundleCount > 0 ? <span>물품 {bundleCount}개</span> : null}
                              <span className="text-slate-500">{recordedAt}</span>
                              {notificationLabel ? (
                                <span className="text-emerald-600">{notificationLabel}</span>
                              ) : null}
                              {trimmedNote ? (
                                <span className="text-slate-500">“{trimmedNote}”</span>
                              ) : null}
                            </div>
                          )
                        })}
                      </div>
                    </ScrollArea>
                  )}
                </section>
              </div>
              <Separator className="mt-4" />
              <DialogFooter className="mt-6 flex flex-col gap-2 border-t border-slate-200 pt-4 sm:flex-row sm:justify-between">
                <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1"
                    onClick={handleInspectionResend}
                    disabled={inspectionActionLoading}
                  >
                    알림 재발송
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="gap-1 text-slate-600"
                    onClick={handleInspectionRequestReinspection}
                    disabled={inspectionActionLoading}
                  >
                    재검 요청
                  </Button>
                  <Button asChild size="sm" variant="ghost" className="gap-1 text-slate-600">
                    <Link href={`/admin/audit?module=fridge&sessionId=${selectedInspection.sessionId}`}>
                      감사 로그 이동
                    </Link>
                  </Button>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={closeInspectionDialog}
                  disabled={inspectionActionLoading}
                >
                  닫기
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={inspectionEditOpen}
        onOpenChange={(open) => {
          setInspectionEditOpen(open)
          if (!open) {
            resetInspectionDraft()
          }
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>검사 정정</DialogTitle>
            <DialogDescription>
              조치 내용을 수정하거나 삭제해 최신 상태로 정정합니다. 저장 시 감사 로그에 기록됩니다.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="inspection-notes" className="text-xs text-muted-foreground">
                검사 메모
              </Label>
              <Textarea
                id="inspection-notes"
                value={inspectionDraftNotes}
                onChange={(event) => setInspectionDraftNotes(event.target.value)}
                placeholder="검사 메모를 입력하세요."
                disabled={inspectionEditSubmitting}
              />
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900">조치 목록</h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddDraftAction}
                  disabled={inspectionEditSubmitting}
                >
                  조치 추가
                </Button>
              </div>
              {inspectionDraftActions.length === 0 ? (
                <p className="text-xs text-slate-500">
                  추가된 조치가 없습니다. “조치 추가” 버튼으로 새 항목을 등록하세요.
                </p>
              ) : (
                <div className="space-y-3">
                  {inspectionDraftActions.map((draft, index) => (
                    <div
                      key={draft.localId}
                      className={cn(
                        "rounded-lg border px-3 py-3 text-xs shadow-sm",
                        draft.remove ? "border-rose-200 bg-rose-50/70" : "border-slate-200 bg-slate-50",
                      )}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-slate-900">조치 {index + 1}</p>
                          <p className="text-[11px] text-slate-500">
                            {draft.roomNumber ? `호실 ${draft.roomNumber}` : null}
                            {draft.roomNumber && typeof draft.personalNo === "number" ? " · " : null}
                            {typeof draft.personalNo === "number" ? `개인번호 ${draft.personalNo}` : null}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {draft.remove ? (
                            <Badge variant="destructive" className="px-2 py-0.5 text-[11px]">
                              삭제 예정
                            </Badge>
                          ) : null}
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-slate-600"
                            onClick={() => handleToggleRemoveDraftAction(draft.localId)}
                            disabled={inspectionEditSubmitting}
                          >
                            {draft.remove ? "복구" : draft.isNew ? "제거" : "삭제"}
                          </Button>
                        </div>
                      </div>
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        <div className="space-y-1">
                          <Label className="text-[11px] text-muted-foreground">조치 유형</Label>
                          <Select
                            value={draft.actionType}
                            onValueChange={(value) =>
                              updateDraftAction(draft.localId, {
                                actionType: (value as InspectionActionType) || DEFAULT_INSPECTION_ACTION,
                              })
                            }
                            disabled={inspectionEditSubmitting || draft.remove}
                          >
                            <SelectTrigger className="h-9 text-xs">
                              <SelectValue placeholder="조치 선택" />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(INSPECTION_ACTION_LABELS).map(([value, label]) => (
                                <SelectItem key={value} value={value}>
                                  {label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[11px] text-muted-foreground">관련 사용자</Label>
                          <p className="rounded-md border border-slate-200 bg-white/60 px-3 py-2 text-[11px] text-slate-600">
                            {draft.targetUserId ? (
                              <Link
                                href={`/admin/users?focus=${draft.targetUserId}`}
                                className="text-emerald-600 hover:underline"
                              >
                                사용자 상세 이동
                              </Link>
                            ) : (
                              "연결된 사용자 없음"
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="mt-2 space-y-1">
                        <Label className="text-[11px] text-muted-foreground">메모</Label>
                        <Textarea
                          value={draft.note}
                          onChange={(event) => updateDraftAction(draft.localId, { note: event.target.value })}
                          placeholder="조치에 대한 추가 설명을 입력하세요."
                          disabled={inspectionEditSubmitting || draft.remove}
                          className="min-h-[80px]"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setInspectionEditOpen(false)
                resetInspectionDraft()
              }}
              disabled={inspectionEditSubmitting}
            >
              취소
            </Button>
            <Button
              type="button"
              onClick={handleInspectionAdjustSubmit}
              disabled={inspectionEditSubmitting}
            >
              {inspectionEditSubmitting ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" aria-hidden /> 저장 중…
                </>
              ) : (
                "저장"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={reallocationOpen} onOpenChange={handleReallocationOpenChange}>
            <DialogTrigger asChild>
              <Button variant="outline" className="h-11 gap-2 rounded-xl border-emerald-200 text-emerald-700 hover:border-emerald-300">
                <Shuffle className="size-4" aria-hidden />
                호실 재배분
              </Button>
            </DialogTrigger>
            <DialogContent className="w-full max-w-4xl sm:max-w-5xl">
              <DialogHeader>
                <DialogTitle>{selectedFloor}층 칸-호실 재배분</DialogTitle>
                <DialogDescription>
                  권장 배정을 확인하고 필요 시 수정한 뒤 적용하세요. 잠금·검사 중인 칸은 별도 해제 후 시도해야
                  합니다.
                </DialogDescription>
              </DialogHeader>
              {reallocationLoading ? (
                <div className="flex items-center justify-center py-16 text-slate-500">
                  <Loader2 className="mr-2 size-5 animate-spin" aria-hidden />
                  호실 재배분 정보를 불러오는 중입니다…
                </div>
              ) : reallocationError ? (
                <div className="rounded-md border border-rose-200 bg-rose-50 p-4 text-sm text-rose-600">
                  {reallocationError}
                </div>
              ) : reallocationPlan ? (
                <>
                  <ScrollArea className="max-h-[420px] w-full pr-4">
                    <div className="space-y-4">
                      {reallocationPlan.allocations.map((allocation) => {
                        const selectedRooms = reallocationSelections[allocation.compartmentId] ?? []
                        const recommendedRooms = allocation.recommendedRoomIds ?? []
                        const warnings = allocation.warnings ?? []
                        const statusBadge = STATUS_BADGE[allocation.status as ResourceStatus]
                        const selectedRoomLabels = selectedRooms.map(
                          (roomId) => roomsMap.get(roomId) ?? roomId.slice(0, 8),
                        )
                        const recommendedRoomLabels = recommendedRooms.map(
                          (roomId) => roomsMap.get(roomId) ?? roomId.slice(0, 8),
                        )
                        const sortedSelectedLabels = sortRoomLabels(selectedRoomLabels)
                        const sortedRecommendedLabels = sortRoomLabels(recommendedRoomLabels)
                        const roomNumbers = formatRoomLabelList(sortedSelectedLabels, "미배정")
                        const recommendedNumbers = formatRoomLabelList(sortedRecommendedLabels, "없음")
                        return (
                          <div
                            key={allocation.compartmentId}
                            className="rounded-lg border border-slate-200 p-4 shadow-sm"
                          >
                            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
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
                                  {sortRoomLabels(
                                    allocation.currentRoomIds.map(
                                      (roomId) => roomsMap.get(roomId) ?? roomId.slice(0, 8),
                                    ),
                                  ).join(", ") || "없음"}
                                </p>
                              </div>
                              <div className="flex flex-wrap items-center gap-2">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="w-[220px] justify-between gap-2"
                                      title={sortedSelectedLabels.join(", ") || "미배정"}
                                    >
                                      <ArrowLeftRight className="size-3.5" aria-hidden />
                                      <span className="truncate text-left">{roomNumbers}</span>
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="max-h-64 overflow-y-auto">
                                    <DropdownMenuLabel>배정 호실 선택</DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    {reallocationPlan.rooms.map((room) => (
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
                                  권장값
                                </Button>
                              </div>
                            </div>
                            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                              <span>
                                권장 배정:{" "}
                                <span
                                  className="font-medium text-slate-700"
                                  title={sortedRecommendedLabels.join(", ") || "없음"}
                                >
                                  {recommendedNumbers}
                                </span>
                              </span>
                              {warnings.map((warning) => {
                                const label = REALLOCATION_WARNING_LABELS[warning] ?? warning
                                return (
                                  <Badge key={warning} variant="destructive" className="gap-1">
                                    <AlertTriangle className="size-3" aria-hidden />
                                    {label}
                                  </Badge>
                                )
                              })}
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
                  호실 재배분 데이터를 불러오지 못했습니다.
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {isMobile ? (
        <section className="space-y-4 lg:hidden">
          <div className="flex flex-col gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">칸 목록</h2>
              <p className="text-xs text-slate-500">
                칸을 선택하면 상세 정보가 하단 팝업으로 열립니다.
              </p>
            </div>
          </div>
          {renderSlotList("grid grid-cols-1 gap-4")}
          {selectedSlot ? (
            <Button
              variant="outline"
              className="flex w-full items-center justify-between rounded-2xl border-emerald-200 bg-emerald-50/60 px-4 py-3 text-sm font-semibold text-emerald-700"
              onClick={() => setMobileDetailOpen(true)}
            >
              <span>
                {selectedSlot.displayName ?? `${selectedSlot.floorNo}F ${selectedSlot.slotLetter}`}
              </span>
              <ArrowRight className="size-4" aria-hidden />
            </Button>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-center text-xs text-slate-500">
              상세 정보를 보려면 칸을 선택하세요.
            </div>
          )}
        </section>
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-[340px_minmax(0,1fr)] xl:grid-cols-[360px_minmax(0,1fr)] xl:gap-8">
          <div className="lg:sticky lg:top-28">
            <section className="space-y-4 lg:max-h-[calc(100vh-9rem)] lg:overflow-y-auto lg:self-start lg:pr-1">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">칸 목록</h2>
                  <p className="text-xs text-slate-500">
                    카드를 선택하면 포장/검사 상세가 우측 패널에 표시됩니다.
                  </p>
                </div>
              </div>
              {renderSlotList("grid grid-cols-1 gap-5")}
            </section>
          </div>
          {detailSection}
        </div>
      )}

      {!isMobile ? (
        <aside
          data-admin-slot="rail"
          className="space-y-4"
          aria-label="냉장고 운영 퀵 액션"
        >
          <section className="rounded-2xl border border-emerald-100 bg-white/90 p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">빠른 실행</h2>
            <p className="mt-1 text-xs text-slate-500">
              재배분, 삭제 이력 확인, 칸 설정 편집을 빠르게 수행할 수 있습니다. Cmd/Ctrl + K로 전역 검색창에 집중하세요.
            </p>
            <ul className="mt-4 space-y-3 text-sm text-slate-700">
              {actionShortcuts.map((item) => (
                <li key={item.id} className="rounded-lg border border-emerald-100 bg-emerald-50/60 p-3 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-emerald-700">{item.label}</p>
                      <p className="mt-1 text-xs text-slate-500">{item.description}</p>
                    </div>
                    {item.href ? (
                      <Button asChild size="icon" variant="ghost" className="text-emerald-600">
                        <Link href={item.href} aria-label={`${item.label} 이동`}>
                          <ArrowRight className="size-4" aria-hidden />
                        </Link>
                      </Button>
                    ) : (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-emerald-600"
                        onClick={item.onClick}
                        aria-label={`${item.label} 실행`}
                      >
                        <ArrowRight className="size-4" aria-hidden />
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      ) : null}

      {isMobile && selectedSlot ? (
        <Sheet open={mobileDetailOpen} onOpenChange={setMobileDetailOpen}>
          <SheetContent side="bottom" className="h-[85vh] overflow-y-auto px-4">
            <SheetHeader className="sr-only">
              <SheetTitle>칸 상세 정보</SheetTitle>
              <SheetDescription>선택한 냉장고 칸의 포장 및 검사 내역을 확인합니다.</SheetDescription>
            </SheetHeader>
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 py-4">
              {detailSection}
            </div>
          </SheetContent>
        </Sheet>
      ) : null}

      <Dialog open={deletedState.open} onOpenChange={handleDeletedOpenChange}>
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
            <div className="flex w-full flex-col-reverse gap-2 text-xs text-slate-500 sm:w-auto sm:flex-row sm:items-center sm:justify-end sm:gap-3">
              <span className="text-center sm:min-w-[140px] sm:text-right">
                {deletedState.page + 1} 페이지 /{" "}
                {Math.max(1, Math.ceil((deletedState.response?.totalCount ?? 0) / DELETED_PAGE_SIZE))}
              </span>
              <div className="grid grid-cols-1 gap-2 sm:flex sm:items-center sm:gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full sm:w-auto"
                  onClick={() => handleDeletedPageChange("prev")}
                  disabled={deletedState.page === 0 || deletedState.loading}
                >
                  이전
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full sm:w-auto"
                  onClick={() => handleDeletedPageChange("next")}
                  disabled={deletedState.loading}
                >
                  다음
                </Button>
              </div>
            </div>
          </div>
          {deletedState.loading ? (
            <div className="flex items-center justify-center py-16 text-sm text-slate-500">
              <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
              삭제 이력을 불러오는 중입니다…
            </div>
          ) : deletedState.error ? (
            <div className="space-y-3 rounded-md border border-rose-200 bg-rose-50 p-4 text-sm text-rose-600">
              <p>{deletedState.error}</p>
              <Button variant="outline" size="sm" onClick={handleDeletedRetry}>
                다시 시도
              </Button>
            </div>
                      ) : (
                        <div className="max-h-[360px] overflow-auto">
                          <Table className="min-w-[720px]">
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
                      const deletedAt = bundle.deletedAt ?? bundle.removedAt ?? bundle.updatedAt
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
                        </div>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={slotConfigDialog.open}
        onOpenChange={(open) => {
          if (!open) {
            if (slotConfigDialog.saving) return
            resetSlotConfigDialog()
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>칸 상태·설정 편집</DialogTitle>
            <DialogDescription>
              선택한 칸의 상태와 최대 포장 용량을 한 번에 조정할 수 있습니다.
            </DialogDescription>
          </DialogHeader>
          {slotConfigDialog.slot ? (
            <div className="space-y-4">
              <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                <p className="font-semibold text-slate-900">
                  {slotConfigDialog.slot.displayName ??
                    `${slotConfigDialog.slot.floorNo}F · ${slotConfigDialog.slot.slotLetter}`}
                </p>
                <p className="mt-1">
                  현재 상태{" "}
                  {STATUS_BADGE[slotConfigDialog.slot.resourceStatus]?.label ??
                    slotConfigDialog.slot.resourceStatus}
                </p>
                {typeof slotConfigDialog.slot.capacity === "number" ? (
                  <p className="mt-1">현재 용량 {slotConfigDialog.slot.capacity}</p>
                ) : null}
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">상태 선택</Label>
                <Select
                  value={slotConfigDialog.status}
                  onValueChange={(value) =>
                    setSlotConfigDialog((prev) => ({
                      ...prev,
                      status: value as ResourceStatus,
                    }))
                  }
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="상태 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {RESOURCE_STATUS_OPTIONS.map((status) => (
                      <SelectItem key={status} value={status}>
                        {STATUS_BADGE[status]?.label ?? status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">최대 포장 용량</Label>
                <Input
                  value={slotConfigDialog.capacity}
                  onChange={(event) =>
                    setSlotConfigDialog((prev) => ({
                      ...prev,
                      capacity: event.target.value,
                    }))
                  }
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="예: 20 (비워두면 변경하지 않음)"
                />
                <p className="text-[10px] text-slate-400">
                  숫자를 입력하면 용량이 변경되며, 비워두면 기존 용량을 유지합니다.
                </p>
              </div>
            </div>
          ) : (
            <p className="py-6 text-sm text-slate-500">편집할 칸 정보를 찾지 못했습니다.</p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={resetSlotConfigDialog}
              disabled={slotConfigDialog.saving}
            >
              취소
            </Button>
            <Button
              type="button"
              onClick={() => void handleSlotConfigSubmit()}
              disabled={
                slotConfigDialog.saving || !slotConfigDialog.slot || !slotConfigHasChanges
              }
            >
              {slotConfigDialog.saving ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                  적용 중…
                </>
              ) : (
                "변경 적용"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
  </Fragment>
  )
}

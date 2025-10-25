"use client"

import { useMemo, useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { FridgeProvider, useFridge } from "@/features/fridge/hooks/fridge-context"
import { formatBundleLabel } from "@/features/fridge/utils/data-shaping"
import { Check, Trash2, Tag, Info, ClipboardCheck, Filter, X, Search, Plus, RotateCcw } from "lucide-react"
import { getCurrentUser, getCurrentUserId } from "@/lib/auth"
import type { Item, Slot } from "@/features/fridge/types"
import SearchBar from "@/features/fridge/components/search-bar"
import WarnMenu from "@/features/fridge/components/warn-menu"
import { SlotSelector } from "@/features/fridge/components/slot-selector"
import { useToast } from "@/hooks/use-toast"
import { formatShortDate, ddayLabel } from "@/lib/date-utils"

const SCHED_KEY = "fridge-inspections-schedule-v1"

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

type Stage = "idle" | "in-progress" | "committed"

type ActionType = "pass" | "discard_expired" | "discard_sticker" | "warn_storage" | "warn_mismatch"
type FilterType = "all" | ActionType
type ResultEntry = {
  id: string
  time: number
  action: ActionType
  unitId?: string
  bundleId?: string
  labelNumber?: number
  bundleLabel?: string
  bundleName?: string
  expiry?: string
  slotCode?: string
  name?: string
  note?: string
}

const HIST_KEY = "fridge-inspections-history-v1"

export default function InspectPage() {
  return (
    <FridgeProvider>
      <InspectInner />
    </FridgeProvider>
  )
}

function InspectInner() {
  const router = useRouter()
  const params = useSearchParams()
  const scheduleId = params.get("id") || ""
  const { items, slots, lastInspectionAt, setLastInspectionNow, deleteItem } = useFridge()
  const { toast } = useToast()

  const [schedule, setSchedule] = useState<Schedule | null>(null)

  useEffect(() => {
    const current = getCurrentUser()
    const canInspect = current?.roles.includes("FLOOR_MANAGER") || current?.roles.includes("ADMIN")
    if (!canInspect) {
      router.replace("/fridge")
      return
    }

    if (scheduleId) {
      try {
        const list = JSON.parse(localStorage.getItem(SCHED_KEY) || "null") as Schedule[] | null
        const s = Array.isArray(list) ? list.find((x) => x.id === scheduleId) || null : null
        if (s?.completed) {
          // 이미 완료된 일정이면 이력으로 이동
          router.replace("/fridge/inspections")
          return
        }
        setSchedule(s)
      } catch {}
    }
  }, [router, scheduleId])

  const [stage, setStage] = useState<Stage>("idle")
  useEffect(() => {
    setStage("in-progress")
  }, [])

  const [tab, setTab] = useState<"before" | "done">("before")
  const [results, setResults] = useState<ResultEntry[]>([])
  const [filter, setFilter] = useState<FilterType>("all")
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [revertConfirmOpen, setRevertConfirmOpen] = useState<string | null>(null) // 되돌리기 확인창용

  // New: filters for '검사 전' view
  const [slotCode, setSlotCode] = useState<string>("")
  const [query, setQuery] = useState("")
  const [showExpired, setShowExpired] = useState(false)
  const [showChanged, setShowChanged] = useState(false)
  const [stickerDialogOpen, setStickerDialogOpen] = useState(false)
  const [stickerName, setStickerName] = useState("")

  // Precompute helpers
  const { singles, bundles } = useMemo(() => {
    const q = query.trim().toLowerCase()
    const processedUnitIds = new Set(results.map((r) => r.unitId).filter(Boolean))
    const map = new Map<string, Item[]>()
    const matchedBundles = new Set<string>()
    const singleItems: Item[] = []

    for (const it of items) {
      if (processedUnitIds.has(it.unitId)) continue
      if (slotCode && it.slotCode !== slotCode) continue

      const expired = daysLeft(it.expiry) < 0
      const createdAtMs = new Date(it.createdAt).getTime()
      const updatedAtMs = new Date(it.updatedAt).getTime()
      const changed = createdAtMs > lastInspectionAt || updatedAtMs > lastInspectionAt
      if (showExpired || showChanged) {
        const passesSpecialFilter = (showExpired && expired) || (showChanged && changed)
        if (!passesSpecialFilter) continue
      }

      const haystack = `${it.bundleLabelDisplay ?? ""} ${it.bundleName ?? ""} ${it.name ?? ""}`.toLowerCase()
      const matchesQuery = !q || haystack.includes(q)

      if (!it.bundleId) {
        if (matchesQuery) singleItems.push(it)
        continue
      }

      if (matchesQuery) matchedBundles.add(it.bundleId)

      const list = map.get(it.bundleId) ?? []
      list.push(it)
      map.set(it.bundleId, list)
    }

    const bundleGroups = Array.from(map.entries())
      .filter(([bundleId]) => !q || matchedBundles.has(bundleId))
      .map(([, list]) => list.slice().sort((a, b) => a.seqNo - b.seqNo))

    return { singles: singleItems.slice().sort((a, b) => a.seqNo - b.seqNo), bundles: bundleGroups }
  }, [items, results, slotCode, showExpired, showChanged, query, lastInspectionAt])

  // 검사 진행 상태 계산
  const processedRegisteredItems = results.filter((r) => r.unitId).length // 등록된 물품만 카운트 (스티커 미부착 제외)
  const totalItems = singles.length + bundles.reduce((sum, grp) => sum + grp.length, 0)
  const remainingItems = totalItems - processedRegisteredItems
  const isInspectionComplete = remainingItems === 0 && totalItems > 0

  // Summary counts for '검사 완료' tab
  const counts = useMemo(() => {
    const c = {
      pass: 0,
      discard_expired: 0,
      discard_sticker: 0,
      warn_storage: 0,
      warn_mismatch: 0,
    }
    for (const r of results) {
      ;(c as any)[r.action]++
    }
    return c
  }, [results])
  const filterChips = useMemo<{ key: FilterType; label: string; color: string }[]>(
    () => [
      { key: "all", label: "전체", color: "bg-gray-100 text-gray-700" },
      { key: "discard_expired", label: `폐기-유통 (${counts.discard_expired})`, color: "bg-rose-100 text-rose-700" },
      { key: "discard_sticker", label: `폐기-스티커 (${counts.discard_sticker})`, color: "bg-rose-100 text-rose-700" },
      { key: "warn_storage", label: `경고-보관 (${counts.warn_storage})`, color: "bg-amber-100 text-amber-700" },
      { key: "warn_mismatch", label: `경고-정보 (${counts.warn_mismatch})`, color: "bg-amber-100 text-amber-700" },
      { key: "pass", label: `통과 (${counts.pass})`, color: "bg-emerald-100 text-emerald-700" },
    ],
    [counts],
  )

  const addResult = (entry: Omit<ResultEntry, "id" | "time">) => {
    setResults((prev) => [
      { id: `R-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, time: Date.now(), ...entry },
      ...prev,
    ])
  }

  // Stage-only until submit
  const markDiscard = (unitId: string) => {
    const it = items.find((x) => x.unitId === unitId)
    if (!it) return
    const bundleLabel = it.bundleLabelDisplay || formatBundleLabel(it.slotCode, it.labelNumber)
    addResult({
      action: "discard_expired",
      unitId: it.unitId,
      bundleId: it.bundleId,
      labelNumber: it.labelNumber,
      bundleLabel,
      bundleName: it.bundleName,
      expiry: it.expiry,
      slotCode: it.slotCode,
      name: it.name,
    })
  }
  const markPass = (unitId: string) => {
    const it = items.find((x) => x.unitId === unitId)
    if (!it) return
    const bundleLabel = it.bundleLabelDisplay || formatBundleLabel(it.slotCode, it.labelNumber)
    addResult({
      action: "pass",
      unitId: it.unitId,
      bundleId: it.bundleId,
      labelNumber: it.labelNumber,
      bundleLabel,
      bundleName: it.bundleName,
      expiry: it.expiry,
      slotCode: it.slotCode,
      name: it.name,
    })
  }
  const markWarn = (unitId: string, kind: Extract<ActionType, "warn_storage" | "warn_mismatch">) => {
    const it = items.find((x) => x.unitId === unitId)
    if (!it) return
    const bundleLabel = it.bundleLabelDisplay || formatBundleLabel(it.slotCode, it.labelNumber)
    addResult({
      action: kind,
      unitId: it.unitId,
      bundleId: it.bundleId,
      labelNumber: it.labelNumber,
      bundleLabel,
      bundleName: it.bundleName,
      expiry: it.expiry,
      slotCode: it.slotCode,
      name: it.name,
    })
  }
  const openStickerDialog = () => {
    setStickerName("")
    setStickerDialogOpen(true)
  }
  const submitStickerDiscard = () => {
    const trimmed = stickerName.trim()
    if (!trimmed) {
      toast({ title: "물품명을 입력하세요.", description: "스티커가 부착되지 않은 물품명을 직접 기록해야 합니다." })
      return
    }
    addResult({
      action: "discard_sticker",
      name: trimmed,
      slotCode: slotCode || undefined,
      note: "스티커 미부착 폐기",
    })
    setStickerDialogOpen(false)
  }

  // 검사 완료된 물품을 되돌리는 함수
  const revertResult = (resultId: string) => {
    setRevertConfirmOpen(resultId)
  }

  const filteredResults = useMemo(() => {
    let filtered = results

    if (filter !== "all") {
      filtered = filtered.filter((r) => r.action === filter)
    }

    if (slotCode) {
      filtered = filtered.filter((r) => r.slotCode === slotCode)
    }

    if (query.trim()) {
      const q = query.trim().toLowerCase()
      filtered = filtered.filter((r) => {
        const haystack = `${r.bundleLabel ?? ""} ${r.bundleName ?? ""} ${r.name ?? ""}`.toLowerCase()
        return haystack.includes(q)
      })
    }

    return filtered.slice().sort((a, b) => b.time - a.time)
  }, [results, filter, slotCode, query])

  const processedGroups = useMemo(() => {
    const map = new Map<
      string,
      {
        key: string
        bundleLabel?: string
        bundleName: string
        slotCode?: string
        items: ResultEntry[]
      }
    >()

    filteredResults.forEach((r) => {
      if (!r.unitId) return
      const key = r.bundleId || r.bundleLabel || r.unitId
      if (!map.has(key)) {
        map.set(key, {
          key,
          bundleLabel: r.bundleLabel,
          bundleName: r.bundleName || r.name || "포장",
          slotCode: r.slotCode,
          items: [],
        })
      }
      map.get(key)!.items.push(r)
    })

    return Array.from(map.values())
      .map((group) => ({
        ...group,
        items: group.items.slice().sort((a, b) => b.time - a.time),
      }))
      .sort((a, b) => {
        const left = (a.bundleLabel || a.bundleName).toLowerCase()
        const right = (b.bundleLabel || b.bundleName).toLowerCase()
        return left.localeCompare(right)
      })
  }, [filteredResults])

  const processedSpecial = useMemo(
    () => filteredResults.filter((r) => !r.unitId),
    [filteredResults],
  )

  const processedItemCount = useMemo(
    () => processedGroups.reduce((sum, group) => sum + group.items.length, 0),
    [processedGroups],
  )

  const summary = useMemo(() => {
    const passed = results.filter((r) => r.action === "pass").length
    const warned = results.filter((r) => r.action === "warn_storage" || r.action === "warn_mismatch").length
    const discarded = results.filter((r) => r.action === "discard_expired" || r.action === "discard_sticker").length
    return { passed, warned, discarded }
  }, [results])

  const finalizeAndPersist = (countsSummary: { passed: number; warned: number; discarded: number }) => {
    // Update items: apply staged mutations (only discards)
    const toDelete = Array.from(
      new Set(results.filter((r) => r.action === "discard_expired" && r.unitId).map((r) => r.unitId!)),
    )
    for (const id of toDelete) deleteItem(id)

    // Append to legacy history (optional)
    const prev = JSON.parse(localStorage.getItem(HIST_KEY) || "[]") as any[]
    const record = {
      id: `H-${Date.now()}`,
      dateISO: new Date().toISOString(),
      passed: countsSummary.passed,
      warned: countsSummary.warned,
      discarded: countsSummary.discarded,
      notes: results.length ? `처리 ${results.length}건` : undefined,
    }
    localStorage.setItem(HIST_KEY, JSON.stringify([record, ...prev]))

    // Also mark the bound schedule as completed
    if (scheduleId) {
      try {
        const list = JSON.parse(localStorage.getItem(SCHED_KEY) || "null") as Schedule[] | null
        if (Array.isArray(list)) {
          const now = new Date().toISOString()
          const updated = list.map((x) =>
            x.id === scheduleId
              ? { ...x, completed: true, completedAt: now, completedBy: getCurrentUserId() || undefined, summary: countsSummary }
              : x,
          )
          localStorage.setItem(SCHED_KEY, JSON.stringify(updated))
        }
      } catch {}
    }

    setLastInspectionNow()
    setStage("committed")
    router.push("/fridge/inspections")
  }

  const finalizeInspection = () => {
    finalizeAndPersist(summary)
  }

  return (
    <main className="min-h-[100svh] bg-white">
      {/* Header: [X] [냉장고 검사(+일정명)] [제출] */}
      <header className="sticky top-0 z-40 border-b bg-white/80 backdrop-blur">
        <div className="mx-auto max-w-screen-sm px-2 py-3 flex items-center">
          <Button
            variant="ghost"
            size="icon"
            aria-label="검사 취소"
            onClick={() => setCancelOpen(true)}
            title="검사 취소"
          >
            <X className="w-5 h-5" />
          </Button>
          <div className="flex-1 text-center">
            <div className="inline-flex items-center gap-2">
              <ClipboardCheck className="w-4 h-4 text-emerald-700" />
              <h1 className="text-base font-semibold leading-none">
                {schedule?.title ? `냉장고 검사 · ${schedule.title}` : "냉장고 검사"}
              </h1>
            </div>
          </div>
          <div className="inline-flex items-center gap-1">
            <Button
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={() => {
                if (results.length === 0) setConfirmOpen(true)
                else finalizeInspection()
              }}
              aria-label="검사 결과 제출"
            >
              {"제출"}
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-screen-sm px-4 pb-28 pt-4 space-y-4">
        {/* Small status indicator */}
        {stage === "in-progress" && (
          <div className="flex items-center gap-2 text-xs text-rose-700" role="status" aria-live="polite">
            <span className="inline-block w-2 h-2 rounded-full bg-rose-600" aria-hidden="true" />
            <span>{"검사 중 · 임시 저장"}</span>
            {totalItems > 0 && (
              <span className="text-gray-600">
                {`(${processedRegisteredItems}건 처리됨 · ${remainingItems}건 남음${isInspectionComplete ? " · 검사 완료" : ""})`}
              </span>
            )}
          </div>
        )}

        {/* Tabs */}
        <div className="inline-flex rounded-md border overflow-hidden">
          <button
            className={`px-3 py-1.5 text-sm ${tab === "before" ? "bg-emerald-600 text-white" : "bg-white"}`}
            onClick={() => setTab("before")}
          >
            {"검사 전"}
            {remainingItems > 0 && (
              <span className="ml-1 text-xs bg-white/20 px-1.5 py-0.5 rounded">
                {remainingItems}
              </span>
            )}
          </button>
          <button
            className={`px-3 py-1.5 text-sm ${tab === "done" ? "bg-emerald-600 text-white" : "bg-white"} ${
              results.length === 0 ? "opacity-50 cursor-not-allowed" : ""
            }`}
            onClick={() => results.length > 0 && setTab("done")}
            disabled={results.length === 0}
          >
            {"검사 완료"}
            {results.length > 0 && (
              <span className="ml-1 text-xs bg-white/20 px-1.5 py-0.5 rounded">
                {results.length}
              </span>
            )}
          </button>
        </div>

        {tab === "before" ? (
          <>
            {/* Filters bar (slot picker + search + chips) */}
            <Card>
              <CardContent className="py-3 space-y-3">
                <div className="flex items-center gap-2">
                  <SlotSelector
                    value={slotCode}
                    onChange={setSlotCode}
                    slots={slots}
                    showAllOption
                    placeholder="전체 칸"
                    className="shrink-0 max-w-[55%]"
                  />
                  <div className="flex-1 min-w-0">
                    <SearchBar
                      value={query}
                      onChange={setQuery}
                      placeholder="식별번호 또는 이름 검색"
                      rightIcon={<Search className="size-4 text-gray-500" aria-hidden="true" />}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant={showExpired ? "default" : "outline"}
                    onClick={() => setShowExpired((v) => !v)}
                    aria-pressed={showExpired}
                  >
                    {"만료"}
                  </Button>
                  <Button
                    size="sm"
                    variant={showChanged ? "default" : "outline"}
                    onClick={() => setShowChanged((v) => !v)}
                    aria-pressed={showChanged}
                  >
                    {"검사일이후 수정됨"}
                  </Button>
                  <Button
                    size="sm"
                    variant="default"
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                    onClick={openStickerDialog}
                    title="스티커 미부착 물품 폐기"
                  >
                    <Plus className="size-4 mr-1" />
                    {"스티커 미부착"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Singles */}
            <Card className="border-emerald-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Info className="w-4 h-4 text-emerald-700" />
                  {"단일 품목"}
                  <Badge variant="secondary" className="ml-auto">{`${singles.length}건`}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {singles.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{"표시할 단일 품목이 없습니다."}</p>
                ) : (
                  <ul className="space-y-2">
                    {singles
                      .slice()
                      .sort((a, b) =>
                        (a.bundleLabelDisplay || a.displayCode || "").localeCompare(
                          b.bundleLabelDisplay || b.displayCode || "",
                        ),
                      )
                      .map((it) => {
                        const d = daysLeft(it.expiry)
                        const expired = d < 0
                        const code = it.bundleLabelDisplay || it.displayCode
                        const location = code || it.slotCode || "-"
                        const detailLine = `${location} • ${formatShortDate(it.expiry)}`
                        return (
                          <li key={it.unitId} className="flex items-center justify-between rounded-md border p-2">
                            {expired ? (
                              // 유통기한 지난 물품: 폐기 버튼 + 물품정보
                              <>
                                <div className="flex items-center gap-2">
                                  <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => markDiscard(it.unitId)}
                                    aria-label="폐기 및 벌점"
                                    title="유통기한 만료로 인한 폐기"
                                  >
                                    <Trash2 className="size-4 mr-1" />
                                    {"폐기"}
                                  </Button>
                                </div>
                                <div className="min-w-0 flex-1 text-center">
                                  <div className="text-sm font-medium truncate">{it.name}</div>
                                  <div className="text-xs text-muted-foreground">{detailLine}</div>
                                </div>
                              </>
                            ) : (
                              // 유통기한 안 지난 물품: 조치버튼 + 물품정보 + 통과버튼
                              <>
                                <div className="flex items-center gap-2">
                                  <WarnMenu onSelect={(k) => markWarn(it.unitId, k)} />
                                </div>
                                <div className="min-w-0 flex-1 text-center">
                                  <div className="text-sm font-medium truncate">{it.name}</div>
                                  <div className="text-xs text-muted-foreground">{detailLine}</div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Button
                                    size="sm"
                                    className="bg-emerald-600 hover:bg-emerald-700"
                                    onClick={() => markPass(it.unitId)}
                                  >
                                    <Check className="size-4 mr-1" />
                                    {"통과"}
                                  </Button>
                                </div>
                              </>
                            )}
                          </li>
                        )
                      })}
                  </ul>
                )}
              </CardContent>
            </Card>

            {/* Bundles */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Info className="w-4 h-4 text-emerald-700" />
                  {"묶음 품목"}
                  <Badge variant="secondary" className="ml-auto">{`${bundles.length}묶음`}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {bundles.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{"표시할 묶음 품목이 없습니다."}</p>
                ) : (
                  <ul className="space-y-3">
                    {bundles.map((grp) => {
                      const first = grp[0]
                      const bundleName = getBundleName(first.name)
                      const bundleCode = formatBundleLabel(first.slotCode, first.labelNumber)
                      return (
                        <li key={first.bundleId} className="rounded-md border p-2">
                          <div className="flex items-center justify-between">
                            <div className="text-sm font-semibold truncate">
                              {`${bundleCode ? `${bundleCode} • ` : ""}${bundleName} · 총 ${grp.length}`}
                            </div>
                          </div>
                          <ul className="mt-2 space-y-2">
                            {grp.map((it) => {
                              const d = daysLeft(it.expiry)
                              const expired = d < 0
                              const detailLine = `${it.slotCode || "-"} • ${formatShortDate(it.expiry)}`
                              return (
                                <li key={it.unitId} className="flex items-center justify-between rounded-md border p-2">
                                  {expired ? (
                                    // 유통기한 지난 물품: 폐기 버튼 + 물품정보
                                    <>
                                      <div className="flex items-center gap-2">
                                        <Button
                                          variant="destructive"
                                          size="sm"
                                          onClick={() => markDiscard(it.unitId)}
                                          aria-label="폐기 및 벌점"
                                          title="유통기한 만료로 인한 폐기"
                                        >
                                          <Trash2 className="size-4 mr-1" />
                                          {"폐기"}
                                        </Button>
                                      </div>
                                      <div className="min-w-0 flex-1 text-center">
                                        <div className="text-sm font-medium truncate">
                                          {getDetailName(it.name, bundleName)}
                                        </div>
                                        <div className="text-xs text-muted-foreground">{detailLine}</div>
                                      </div>
                                    </>
                                  ) : (
                                    // 유통기한 안 지난 물품: 조치버튼 + 물품정보 + 통과버튼
                                    <>
                                      <div className="flex items-center gap-2">
                                        <WarnMenu onSelect={(k) => markWarn(it.unitId, k)} />
                                      </div>
                                      <div className="min-w-0 flex-1 text-center">
                                        <div className="text-sm font-medium truncate">
                                          {getDetailName(it.name, bundleName)}
                                        </div>
                                        <div className="text-xs text-muted-foreground">{detailLine}</div>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <Button
                                          size="sm"
                                          className="bg-emerald-600 hover:bg-emerald-700"
                                          onClick={() => markPass(it.unitId)}
                                        >
                                          <Check className="size-4 mr-1" />
                                          {"통과"}
                                        </Button>
                                      </div>
                                    </>
                                  )}
                                </li>
                              )
                            })}
                          </ul>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>
          </>
        ) : (
          <>
            {/* Completed list with filters */}
            {/* 상단 필터 영역 카드 */}
            <Card>
              <CardContent className="py-3 space-y-3">
                {/* 검색 및 필터 바 */}
                <div className="flex items-center gap-2">
                  {/* 칸별 드롭다운 */}
                  <SlotSelector
                    value={slotCode}
                    onChange={setSlotCode}
                    slots={slots}
                    showAllOption
                    placeholder="전체 칸"
                    className="shrink-0 max-w-[55%]"
                  />
                  
                  {/* 식별번호 검색 */}
                  <div className="flex-1 min-w-0">
                    <SearchBar
                      value={query}
                      onChange={setQuery}
                      placeholder="식별번호 또는 이름 검색"
                      rightIcon={<Search className="size-4 text-gray-500" aria-hidden="true" />}
                    />
                  </div>
                </div>

                {/* 태그 필터 */}
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                  <Filter className="w-4 h-4 text-gray-500" aria-hidden />
                  {filterChips.map((f) => (
                    <Button
                      key={f.key}
                      size="sm"
                      variant={filter === f.key ? "default" : "outline"}
                      className={`shrink-0 ${filter === f.key ? "" : f.color}`}
                      onClick={() => setFilter(f.key)}
                    >
                      {f.label}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* 결과 목록 카드 */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <ClipboardCheck className="w-4 h-4 text-emerald-700" />
                  {"처리 내역"}
                  <span className="text-xs text-muted-foreground font-normal">{"(최신순)"}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{`${
                    processedItemCount + processedSpecial.length
                  }건`}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {processedItemCount + processedSpecial.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {results.length === 0 ? "표시할 내역이 없습니다." : "검색 조건에 맞는 내역이 없습니다."}
                  </p>
                ) : (
                  <>
                    {processedGroups.length > 0 && (
                      <ul className="space-y-3">
                        {processedGroups.map((group) => (
                          <li key={group.key} className="rounded-md border p-2">
                            <div className="flex items-center justify-between">
                              <div className="text-sm font-semibold truncate">
                                {`${group.bundleLabel ? `${group.bundleLabel} • ` : ""}${group.bundleName} · ${group.items.length}건`}
                              </div>
                              {!group.bundleLabel && group.slotCode && (
                                <span className="text-xs text-muted-foreground">{group.slotCode}</span>
                              )}
                            </div>
                            <ul className="mt-2 space-y-2">
                              {group.items.map((r) => {
                                const expiryText = r.expiry ? formatShortDate(r.expiry) : ""
                                const diff = r.expiry ? daysLeft(r.expiry) : Number.NaN
                                const diffLabel = r.expiry ? ddayLabel(diff) : ""
                                const meta = [group.bundleLabel, expiryText, diffLabel, !group.bundleLabel ? r.slotCode : undefined]
                                  .filter(Boolean)
                                  .join(" • ")
                                return (
                                  <li key={r.id} className="flex items-center justify-between rounded-md border p-2">
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-2">
                                        <Badge
                                          variant="secondary"
                                          className={`${
                                            r.action === "pass"
                                              ? "bg-emerald-100 text-emerald-700"
                                              : r.action.startsWith("warn")
                                                ? "bg-amber-100 text-amber-700"
                                                : "bg-rose-100 text-rose-700"
                                          }`}
                                        >
                                          {badgeForAction(r.action)}
                                        </Badge>
                                        <span className="text-sm font-medium truncate">{r.name || "세부 물품"}</span>
                                      </div>
                                      {meta && (
                                        <div className="text-xs text-muted-foreground truncate mt-1">{meta}</div>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0 ml-2">
                                      <div className="text-xs text-muted-foreground">{labelForAction(r.action)}</div>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="text-xs h-6 px-2 border-gray-300 hover:bg-gray-50"
                                        onClick={() => revertResult(r.id)}
                                        title="검사 결과 취소하기"
                                      >
                                        <RotateCcw className="w-3 h-3 mr-1" />
                                        {"검사취소"}
                                      </Button>
                                    </div>
                                  </li>
                                )
                              })}
                            </ul>
                          </li>
                        ))}
                      </ul>
                    )}

                    {processedSpecial.length > 0 && (
                      <div>
                        <div className="text-xs font-semibold text-slate-600 mb-2">{"기록 전용 항목"}</div>
                        <ul className="space-y-2">
                          {processedSpecial.map((r) => (
                            <li key={r.id} className="flex items-center justify-between rounded-md border p-2">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <Badge
                                    variant="secondary"
                                    className={`${
                                      r.action === "pass"
                                        ? "bg-emerald-100 text-emerald-700"
                                        : r.action.startsWith("warn")
                                          ? "bg-amber-100 text-amber-700"
                                          : "bg-rose-100 text-rose-700"
                                    }`}
                                  >
                                    {badgeForAction(r.action)}
                                  </Badge>
                                  <span className="text-sm font-medium truncate">{r.name || "기록"}</span>
                                </div>
                                <div className="text-xs text-muted-foreground mt-1 truncate">
                                  {new Date(r.time).toLocaleTimeString()}
                                </div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0 ml-2">
                                <div className="text-xs text-muted-foreground">{labelForAction(r.action)}</div>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-xs h-6 px-2 border-gray-300 hover:bg-gray-50"
                                  onClick={() => revertResult(r.id)}
                                  title="검사 결과 취소하기"
                                >
                                  <RotateCcw className="w-3 h-3 mr-1" />
                                  {"검사취소"}
                                </Button>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </>
                )}

                {/* 제출 버튼과 요약 정보 */}
                <div className="flex items-center justify-end gap-3 pt-2 border-t">
                  <div className="text-xs text-muted-foreground mr-auto">
                    <span className="mr-2">{`통과 ${summary.passed}`}</span>
                    <span className="mr-2">{`경고 ${summary.warned}`}</span>
                    <span className="mr-2">{`폐기-유통 ${counts.discard_expired}`}</span>
                    <span>{`폐기-스티커 ${counts.discard_sticker}`}</span>
                    {totalItems > 0 && (
                      <span className="ml-2 text-emerald-600 font-medium">
                        {isInspectionComplete ? "✓ 검사 완료" : `${remainingItems}건 남음`}
                      </span>
                    )}
                  </div>
                  <Button
                    className={`${isInspectionComplete ? "bg-emerald-600 hover:bg-emerald-700" : "bg-amber-600 hover:bg-amber-700"}`}
                    onClick={() => {
                      if (results.length === 0) {
                        setConfirmOpen(true)
                        return
                      }
                      finalizeInspection()
                    }}
                    disabled={totalItems > 0 && !isInspectionComplete}
                  >
                    {isInspectionComplete ? "검사 완료 제출" : "검사 진행 중"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Sticker missing dialog */}
      <Dialog open={stickerDialogOpen} onOpenChange={setStickerDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{"스티커 미부착 물품 기록"}</DialogTitle>
          </DialogHeader>
          <DialogDescription className="sr-only">
            {"스티커가 부착되지 않은 물품의 이름을 입력하고 폐기 처리합니다."}
          </DialogDescription>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {"스티커가 부착되지 않은 물품의 이름을 입력하면 '폐기-스티커' 항목으로 기록됩니다."}
            </p>
            <div className="space-y-2">
              <Label htmlFor="sticker-item-name" className="text-xs">
                {"물품 이름"}
              </Label>
              <Input
                id="sticker-item-name"
                value={stickerName}
                onChange={(e) => setStickerName(e.target.value)}
                placeholder="예: 3층 냉동실 김치통"
                maxLength={40}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setStickerDialogOpen(false)}>
              {"취소"}
            </Button>
            <Button className="bg-rose-600 hover:bg-rose-700" onClick={submitStickerDiscard}>
              {"폐기 기록"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm when no results */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{"처리 내역이 없습니다"}</DialogTitle>
          </DialogHeader>
          <DialogDescription className="sr-only">
            {"처리 내역 없이 검사 기준일을 갱신할지 확인합니다."}
          </DialogDescription>
          <p className="text-sm text-muted-foreground">
            {"처리된 내역이 없지만 검사 기준일을 갱신하고 이력으로 돌아갈까요?"}
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              {"취소"}
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={() => {
                setLastInspectionNow()
                setStage("committed")
                router.push("/fridge/inspections")
              }}
            >
              {"기준일 갱신"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Cancel inspection confirmation */}
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{"검사를 취소할까요?"}</DialogTitle>
          </DialogHeader>
          <DialogDescription className="sr-only">
            {"임시 처리 내역이 폐기되며 데이터베이스에는 반영되지 않습니다."}
          </DialogDescription>
          <p className="text-sm text-muted-foreground">
            {"제출하지 않은 임시 처리 내역은 모두 폐기됩니다. (데이터베이스에는 반영되지 않습니다.)"}
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setCancelOpen(false)}>
              {"계속 검사"}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setStage("idle")
                router.push("/fridge/inspections")
              }}
            >
              {"검사 취소"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Revert inspection confirmation */}
      {revertConfirmOpen && (
        <Dialog open={!!revertConfirmOpen} onOpenChange={(open) => !open && setRevertConfirmOpen(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{"검사 결과를 되돌리시겠습니까?"}</DialogTitle>
            </DialogHeader>
            <DialogDescription className="sr-only">
              {"검사 결과를 되돌리면 해당 물품의 검사 상태가 원래대로 복원됩니다."}
            </DialogDescription>
            <p className="text-sm text-muted-foreground">
              {"검사 결과를 되돌리면 해당 물품의 검사 상태가 원래대로 복원됩니다."}
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setRevertConfirmOpen(null)}>
                {"취소"}
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  setResults(prev => prev.filter(r => r.id !== revertConfirmOpen));
                  setRevertConfirmOpen(null);
                }}
              >
                {"되돌리기"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </main>
  )
}

function getBundleName(name: string) {
  const idx = name.indexOf(" - ")
  return idx >= 0 ? name.slice(0, idx) : name
}
function getDetailName(name: string, bundleName: string) {
  const prefix = `${bundleName} - `
  return name.startsWith(prefix) ? name.slice(prefix.length) : name
}
function daysLeft(dateISO: string) {
  const today = new Date(new Date().toDateString())
  const d = new Date(dateISO)
  return Math.floor((d.getTime() - today.getTime()) / 86400000)
}
function labelForAction(a: ActionType) {
  switch (a) {
    case "pass":
      return "통과됨"
    case "discard_expired":
      return "폐기됨 (유통기한)"
    case "discard_sticker":
      return "폐기됨 (스티커 미부착)"
    case "warn_storage":
      return "경고됨 (보관상태 불량)"
    case "warn_mismatch":
      return "경고됨 (정보 불일치)"
  }
}
function badgeForAction(a: ActionType) {
  switch (a) {
    case "pass":
      return "PASS"
    case "discard_expired":
      return "폐기"
    case "discard_sticker":
      return "폐기"
    case "warn_storage":
      return "경고"
    case "warn_mismatch":
      return "경고"
  }
}

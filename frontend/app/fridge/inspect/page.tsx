"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { ClipboardCheck, Filter, Loader2, Search, Tag, Trash2, X, Check, RotateCcw } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import SearchBar from "@/features/fridge/components/search-bar"
import WarnMenu from "@/features/fridge/components/warn-menu"
import type { Item, Slot } from "@/features/fridge/types"
import type { InspectionAction, InspectionSession } from "@/features/inspections/types"
import {
  cancelInspection,
  fetchActiveInspection,
  fetchInspection,
  fetchInspectionSlots,
  recordInspectionActions,
  submitInspection,
  deleteInspectionAction,
} from "@/features/inspections/api"
import { getCurrentUser } from "@/lib/auth"
import { daysLeft, ddayLabel, formatShortDate } from "@/lib/date-utils"
import { formatCompartmentLabel, formatSlotDisplayName, formatStickerLabel } from "@/features/fridge/utils/labels"

type Stage = "idle" | "in-progress" | "committed"

type ResultEntry = {
  id: string
  time: number
  action: InspectionAction
  actionRecordId?: number | null
  itemId?: string
  bundleId?: string
  bundleLabel?: string
  bundleName?: string
  expiryDate?: string
  name?: string
  note?: string
  origin?: "local" | "sync"
  correlationId?: string | null
  penaltyCount?: number
  recordedAt?: string
}

type FilterType = "ALL" | InspectionAction

type ItemGroup = {
  bundleId: string
  bundleName: string
  bundleLabel?: string | null
  items: Item[]
}

const ACTION_LABEL: Record<InspectionAction, string> = {
  PASS: "통과",
  DISPOSE_EXPIRED: "폐기-유통",
  UNREGISTERED_DISPOSE: "폐기-미등록",
  WARN_INFO_MISMATCH: "경고-정보",
  WARN_STORAGE_POOR: "경고-보관",
}

const ACTION_ICON_COLOR: Record<InspectionAction, { bg: string; text: string }> = {
  PASS: { bg: "bg-emerald-100", text: "text-emerald-700" },
  DISPOSE_EXPIRED: { bg: "bg-rose-100", text: "text-rose-700" },
  UNREGISTERED_DISPOSE: { bg: "bg-rose-100", text: "text-rose-700" },
  WARN_INFO_MISMATCH: { bg: "bg-amber-100", text: "text-amber-700" },
  WARN_STORAGE_POOR: { bg: "bg-amber-100", text: "text-amber-700" },
}

const STORAGE_KEY_PREFIX = "inspection-results-v1-"
const DRAFT_RETENTION_MS = 2 * 24 * 60 * 60 * 1000

export default function InspectPage() {
  return <InspectInner />
}

function InspectInner() {
  const router = useRouter()
  const params = useSearchParams()
  const sessionIdParam = params.get("sessionId")
  const { toast } = useToast()

  const [session, setSession] = useState<InspectionSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [stage, setStage] = useState<Stage>("idle")
  const [tab, setTab] = useState<"before" | "done">("before")
  const [filter, setFilter] = useState<FilterType>("ALL")
  const [query, setQuery] = useState("")
  const [showExpired, setShowExpired] = useState(false)
  const [showUpdatedOnly, setShowUpdatedOnly] = useState(false)
  const [results, setResults] = useState<ResultEntry[]>([])
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [stickerDialogOpen, setStickerDialogOpen] = useState(false)
  const [stickerName, setStickerName] = useState("")
  const [slots, setSlots] = useState<Slot[]>([])
  const resultsHydratedRef = useRef(false)
  const skipSummarySyncRef = useRef(false)
  const bundleOrderRef = useRef<Record<string, number>>({})
  const persistErrorNotifiedRef = useRef(false)
  const prevStorageKeyRef = useRef<string | null>(null)
  const [lastDraftSavedAt, setLastDraftSavedAt] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const refreshSlots = useCallback(async () => {
    try {
      const data = await fetchInspectionSlots()
      setSlots(data)
    } catch (error) {
      console.error("Failed to refresh inspection slots", error)
    }
  }, [])

  useEffect(() => {
    const current = getCurrentUser()
    const canInspect = current?.roles.includes("FLOOR_MANAGER") || current?.roles.includes("ADMIN")
    if (!canInspect) {
      router.replace("/fridge")
      return
    }

    const load = async () => {
      setLoading(true)
      try {
        const sessionId = sessionIdParam ?? undefined
        const data = sessionId ? await fetchInspection(sessionId) : await fetchActiveInspection()
        if (!data) {
          toast({
            title: "진행 중인 검사 없음",
            description: "먼저 검사 개요 화면에서 새 검사를 시작해 주세요.",
          })
          router.replace("/fridge/inspections")
          return
        }
        setSession(data)
        setStage(data.status === "SUBMITTED" ? "committed" : "in-progress")
        setShowExpired(false)
        setShowUpdatedOnly(false)
      } catch (err) {
        const message = err instanceof Error ? err.message : "검사 세션을 불러오지 못했습니다."
        toast({
          title: "검사 조회 실패",
          description: message,
          variant: "destructive",
        })
        router.replace("/fridge/inspections")
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [router, sessionIdParam, toast])

  useEffect(() => {
    let ignore = false
    const loadSlots = async () => {
      try {
        const data = await fetchInspectionSlots()
        if (!ignore) {
          setSlots(data)
        }
      } catch (error) {
        console.error("Failed to load inspection slots", error)
      }
    }
    void loadSlots()
    return () => {
      ignore = true
    }
  }, [])

  useEffect(() => {
    if (!session || stage === "committed") return
    if (typeof window === "undefined") return
    const sessionId = session.sessionId
    const intervalId = window.setInterval(() => {
      void fetchInspection(sessionId)
        .then((data) => {
          if (data) {
            setSession(data)
          }
        })
        .catch((error) => {
          console.error("Failed to sync inspection session", error)
        })
    }, 30000)
    return () => {
      window.clearInterval(intervalId)
    }
  }, [session, stage])

  const items = useMemo(() => session?.items ?? [], [session])

  useEffect(() => {
    if (!session) return
    const order = bundleOrderRef.current
    session.items.forEach((item, index) => {
      const key = item.bundleId ?? item.unitId
      if (!(key in order)) {
        order[key] = index + Object.keys(order).length / 1000
      }
    })
  }, [session])
  const storageKey = session?.sessionId ? `${STORAGE_KEY_PREFIX}${session.sessionId}` : null
  const totalItems = items.length

  const getSlotLabel = useCallback(
    (slotId: string, slotIndex: number) => {
      const slot = slots.find((candidate) => candidate.slotId === slotId)
      return slot ? formatSlotDisplayName(slot) : formatCompartmentLabel(slotIndex)
    },
    [slots],
  )

  const processedUnitIds = useMemo(() => {
    const ids = new Set<string>()
    for (const entry of results) {
      if (entry.itemId) ids.add(entry.itemId)
    }
    return ids
  }, [results])
  const processedCount = processedUnitIds.size
  const remainingItems = Math.max(totalItems - processedCount, 0)
  const isInspectionComplete = remainingItems === 0 && totalItems > 0

  const filteredItems = useMemo(() => {
    let list: Item[] = items
    if (processedUnitIds.size > 0) {
      list = list.filter((item) => !processedUnitIds.has(item.unitId))
    }
    if (showExpired) {
      list = list.filter((item) => daysLeft(item.expiryDate) < 0)
    }
    if (showUpdatedOnly) {
      list = list.filter((item) => item.updatedAfterInspection)
    }
    if (query.trim()) {
      const q = query.trim().toLowerCase()
      list = list.filter((item) => {
        const haystack = `${item.bundleLabelDisplay ?? ""} ${item.bundleName ?? ""} ${item.name ?? ""}`.toLowerCase()
        return haystack.includes(q)
      })
    }
    return list
  }, [items, processedUnitIds, showExpired, showUpdatedOnly, query])

  const itemGroups = useMemo<ItemGroup[]>(() => {
    const map = new Map<string, ItemGroup & { order: number }>()

    filteredItems.forEach((item) => {
      const key = item.bundleId ?? item.unitId
      const order = bundleOrderRef.current[key] ?? Number.POSITIVE_INFINITY
      if (!map.has(key)) {
        map.set(key, {
          bundleId: key,
          bundleName: item.bundleName ?? "묶음",
          bundleLabel: item.bundleLabelDisplay ?? formatStickerLabel(item.slotIndex, item.labelNumber),
          items: [],
          order,
        })
      }
      map.get(key)!.items.push(item)
    })

    return Array.from(map.values())
      .map((group) => ({
        bundleId: group.bundleId,
        bundleName: group.bundleName,
        bundleLabel: group.bundleLabel,
        items: group.items.slice().sort((a, b) => a.seqNo - b.seqNo),
        order: group.order,
      }))
      .sort((a, b) => a.order - b.order)
      .map(({ order, ...rest }) => rest)
  }, [filteredItems])

  const filteredResults = useMemo(() => {
    if (filter === "ALL") return results
    return results.filter((entry) => entry.action === filter)
  }, [filter, results])

  const summaryFromServer = useMemo(() => session?.summary ?? [], [session])

  const clearStoredResults = useCallback(() => {
    if (storageKey && typeof window !== "undefined") {
      window.localStorage.removeItem(storageKey)
      window.sessionStorage.removeItem(storageKey)
    }
    skipSummarySyncRef.current = true
    resultsHydratedRef.current = true
    setResults([])
  }, [storageKey])

  const persistResultsToLocal = useCallback(() => {
    if (!storageKey || typeof window === "undefined") return
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(results))
      persistErrorNotifiedRef.current = false
      setLastDraftSavedAt(Date.now())
    } catch (error) {
      console.warn("failed to persist inspection results", error)
      if (!persistErrorNotifiedRef.current) {
        toast({
          title: "임시 저장에 실패했습니다",
          description: "브라우저 저장소를 정리한 뒤 다시 시도해 주세요.",
          variant: "destructive",
        })
        persistErrorNotifiedRef.current = true
      }
    }
  }, [results, storageKey, toast])

  const purgeStaleDrafts = useCallback(() => {
    if (typeof window === "undefined") return

    const cutoff = Date.now() - DRAFT_RETENTION_MS
    const storages: Storage[] = [window.localStorage, window.sessionStorage]

    storages.forEach((store) => {
      const keys: string[] = []
      for (let index = 0; index < store.length; index += 1) {
        const key = store.key(index)
        if (key && key.startsWith(STORAGE_KEY_PREFIX)) {
          keys.push(key)
        }
      }

      keys.forEach((key) => {
        try {
          const raw = store.getItem(key)
          if (!raw) {
            store.removeItem(key)
            return
          }

          const parsed: any = JSON.parse(raw)
          const entries: any[] = Array.isArray(parsed)
            ? parsed
            : Array.isArray(parsed?.entries)
              ? parsed.entries
              : []

          let latest: number | null = null
          if (Array.isArray(entries)) {
            entries.forEach((entry) => {
              const value = typeof entry?.time === "number" ? entry.time : undefined
              if (typeof value === "number" && (latest === null || value > latest)) {
                latest = value
              }
            })
          }

          if (latest === null || latest < cutoff) {
            store.removeItem(key)
          }
        } catch (error) {
          store.removeItem(key)
        }
      })
    })
  }, [])

  const groupedResults = useMemo(() => {
    const map = new Map<string, { bundleName: string; bundleLabel?: string | null; entries: ResultEntry[]; order: number }>()
    const singles: Array<{ entry: ResultEntry; order: number }> = []

    filteredResults.forEach((entry, index) => {
      if (entry.bundleId) {
        if (!map.has(entry.bundleId)) {
          map.set(entry.bundleId, {
            bundleName: entry.bundleName ?? "묶음",
            bundleLabel: entry.bundleLabel,
            entries: [],
            order: index,
          })
        }
        map.get(entry.bundleId)!.entries.push(entry)
      } else {
        singles.push({ entry, order: index })
      }
    })

    const groups = Array.from(map.entries())
      .sort((a, b) => a[1].order - b[1].order)
      .map(([bundleId, value]) => ({ bundleId, ...value }))

    const singleList = singles.sort((a, b) => a.order - b.order).map((item) => item.entry)

    return { groups, singles: singleList }
  }, [filteredResults])

  useEffect(() => {
    purgeStaleDrafts()
  }, [purgeStaleDrafts])

  useEffect(() => {
    if (stage !== "committed") return
    clearStoredResults()
  }, [clearStoredResults, stage])

  useEffect(() => {
    if (typeof window === "undefined") return
    const previousKey = prevStorageKeyRef.current
    if (previousKey && previousKey !== storageKey) {
      window.localStorage.removeItem(previousKey)
      window.sessionStorage.removeItem(previousKey)
    }
    prevStorageKeyRef.current = storageKey ?? null
  }, [storageKey])

  useEffect(() => {
    if (!storageKey) return
    if (typeof window === "undefined") return

    try {
      let raw = window.localStorage.getItem(storageKey)
      if (!raw) {
        raw = window.sessionStorage.getItem(storageKey)
        if (raw) {
          window.localStorage.setItem(storageKey, raw)
          window.sessionStorage.removeItem(storageKey)
        }
      }

      if (!raw) {
        setResults([])
      } else {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) {
          const normalized: ResultEntry[] = parsed.map(
            (entry: ResultEntry & { expiry?: string; slotIndex?: number; labelNumber?: number }) => {
              const time =
                typeof entry.time === "number"
                  ? entry.time
                  : entry.time
                    ? new Date(entry.time).getTime()
                    : Date.now()

              return {
                ...entry,
                time,
                expiryDate: entry.expiryDate ?? entry.expiry ?? undefined,
                bundleLabel:
                  entry.bundleLabel ??
                  (typeof entry.slotIndex === "number" && typeof entry.labelNumber === "number"
                    ? formatStickerLabel(entry.slotIndex, entry.labelNumber)
                    : entry.bundleLabel),
                origin: entry.origin === "sync" ? "sync" : "local",
              }
            },
          )
          setResults(normalized)
        } else {
          setResults([])
        }
      }
    } catch (error) {
      console.warn("failed to restore inspection results", error)
      setResults([])
    } finally {
      resultsHydratedRef.current = true
    }
  }, [storageKey])

  useEffect(() => {
    if (!resultsHydratedRef.current) return
    persistResultsToLocal()
  }, [persistResultsToLocal])

  useEffect(() => {
    if (!summaryFromServer.length) return
    if (skipSummarySyncRef.current) {
      skipSummarySyncRef.current = false
      return
    }

    setResults((prev) => {
      const counts = prev.reduce<Record<InspectionAction, number>>((acc, entry) => {
        acc[entry.action] = (acc[entry.action] ?? 0) + 1
        return acc
      }, {} as Record<InspectionAction, number>)

      let next = prev
      let updated = false

      for (const summary of summaryFromServer) {
        const current = counts[summary.action] ?? 0
        const diff = summary.count - current
        if (diff > 0) {
          if (!updated) {
            next = [...prev]
            updated = true
          }
          for (let i = 0; i < diff; i += 1) {
            next = [
              {
                id: `S-${Date.now()}-${Math.random().toString(36).slice(2, 6)}-${i}`,
                time: Date.now(),
                action: summary.action,
                origin: "sync",
              } satisfies ResultEntry,
              ...next,
            ]
          }
        }
      }

      return updated ? next : prev
    })
  }, [summaryFromServer])

  const addResult = (entry: Omit<ResultEntry, "id" | "time">) => {
    setResults((prev) => [
      {
        id: `R-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        time: Date.now(),
        origin: entry.origin ?? "local",
        ...entry,
      },
      ...prev,
    ])
  }

  const handleRecordAction = async (payload: {
    action: InspectionAction
    item?: Item
    note?: string
  }) => {
    if (!session) return
    try {
      const previousActionIds = new Set(session.actions?.map((action) => action.actionId))
      const response = await recordInspectionActions(session.sessionId, [
        {
          action: payload.action,
          itemId: payload.item?.unitId ?? null,
          bundleId: payload.item?.bundleId ?? null,
          note: payload.note ?? null,
        },
      ])
      const newAction =
        response.actions?.find((action) => !previousActionIds.has(action.actionId)) ??
        response.actions?.[response.actions.length - 1]
      setSession(response)
      const correlationId = newAction?.correlationId ?? null
      const penaltyCount = newAction?.penalties?.length ?? 0
      const recordedAt = newAction?.recordedAt
      const actionRecordId = newAction?.actionId ?? null
      if (payload.item) {
        addResult({
          action: payload.action,
          actionRecordId,
          itemId: payload.item.unitId,
          bundleId: payload.item.bundleId,
          bundleLabel: payload.item.bundleLabelDisplay ?? formatStickerLabel(payload.item.slotIndex, payload.item.labelNumber),
          bundleName: payload.item.bundleName,
          expiryDate: payload.item.expiryDate,
          name: payload.item.name,
          note: payload.note,
          correlationId,
          penaltyCount,
          recordedAt,
          actionRecordId,
        })
      } else {
        addResult({
          action: payload.action,
          actionRecordId,
          note: payload.note,
          correlationId,
          penaltyCount,
          recordedAt,
        })
      }
      toast({
        title: "조치가 기록되었습니다.",
        description: ACTION_LABEL[payload.action],
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : "조치 기록에 실패했습니다."
      toast({
        title: "조치 기록 실패",
        description: message,
        variant: "destructive",
      })
    }
  }

  const markPass = (item: Item) => handleRecordAction({ action: "PASS", item })
  const markWarn = (item: Item, type: "WARN_INFO_MISMATCH" | "WARN_STORAGE_POOR") =>
    handleRecordAction({ action: type, item })
  const markDiscardExpired = (item: Item) => handleRecordAction({ action: "DISPOSE_EXPIRED", item })

  const handleStickerSubmit = async () => {
    if (!stickerName.trim()) return
    await handleRecordAction({ action: "UNREGISTERED_DISPOSE", note: stickerName.trim() })
    setStickerName("")
    setStickerDialogOpen(false)
  }

  const handleRestartEntry = useCallback(
    async (entry: ResultEntry) => {
      if (!session) return
      if (!entry.actionRecordId) {
        toast({
          title: "되돌릴 수 없습니다.",
          description: "삭제할 조치 정보를 찾지 못했습니다.",
          variant: "destructive",
        })
        return
      }
      try {
        const response = await deleteInspectionAction(session.sessionId, entry.actionRecordId)
        setSession(response)
        setResults((prev) => prev.filter((candidate) => candidate.id !== entry.id))
        toast({
          title: entry.itemId ? "검사 결과를 되돌렸습니다." : "조치가 삭제되었습니다.",
          description: entry.name ?? ACTION_LABEL[entry.action],
        })
        if (entry.itemId) {
          setTab("before")
        }
      } catch (error) {
        toast({
          title: "되돌리기에 실패했습니다.",
          description: error instanceof Error ? error.message : "잠시 후 다시 시도해 주세요.",
          variant: "destructive",
        })
      }
    },
    [session, toast],
  )

  const summaryMetrics = useMemo(() => {
    const summaryList = session?.summary ?? []
    const findCount = (action: InspectionAction): number =>
      summaryList.find((entry) => entry.action === action)?.count ?? 0

    const passCount = findCount("PASS")
    const warnCount = findCount("WARN_INFO_MISMATCH") + findCount("WARN_STORAGE_POOR")
    const registeredDisposalCount = findCount("DISPOSE_EXPIRED")
    const unregisteredDisposalCount = findCount("UNREGISTERED_DISPOSE")
    const disposalCount = registeredDisposalCount + unregisteredDisposalCount
    const totalActions = summaryList.reduce((acc, entry) => acc + (entry.count ?? 0), 0)

    return {
      passCount,
      warnCount,
      registeredDisposalCount,
      unregisteredDisposalCount,
      disposalCount,
      totalActions,
    }
  }, [session])

  const finalizeInspection = async () => {
    if (!session) return
    try {
      setSubmitting(true)
      const response = await submitInspection(session.sessionId, {})
      setSession(response)
      setStage("committed")
      clearStoredResults()
      await refreshSlots()
      toast({
        title: "검사 결과가 제출되었습니다.",
      })
      setSubmitDialogOpen(false)
      router.replace("/fridge/inspections")
    } catch (err) {
      const message = err instanceof Error ? err.message : "검사 제출에 실패했습니다."
      toast({
        title: "검사 제출 실패",
        description: message,
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleCancelSession = async () => {
    if (!session) return

    try {
      await cancelInspection(session.sessionId)
      clearStoredResults()
      await refreshSlots()
      toast({ title: "검사 세션이 취소되었습니다." })
    } catch (error) {
      const message = error instanceof Error ? error.message : "검사 취소에 실패했습니다."
      toast({
        title: "검사 취소 실패",
        description: message,
        variant: "destructive",
      })
    } finally {
      router.replace("/fridge/inspections")
    }
  }

  const handleSaveDraft = () => {
    if (!resultsHydratedRef.current) return
    persistResultsToLocal()
    setLastDraftSavedAt(Date.now())
    toast({ title: "임시 저장이 완료되었습니다." })
  }

  const openStickerDialog = () => {
    setStickerName("")
    setStickerDialogOpen(true)
  }

  if (loading || !session) {
    return (
      <main className="min-h-[100svh] bg-white">
        <div className="mx-auto max-w-screen-sm px-4 py-24 text-center text-sm text-muted-foreground">
          <Loader2 className="mx-auto mb-3 size-5 animate-spin text-emerald-600" aria-hidden />
          {"검사 세션을 불러오는 중입니다..."}
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-[100svh] bg-white">
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
              <h1 className="text-base font-semibold leading-none">{`냉장고 검사 · ${getSlotLabel(
                session.slotId,
                session.slotIndex,
              )}`}</h1>
            </div>
          </div>
          <div className="inline-flex flex-col items-end gap-1">
            <div className="inline-flex items-center gap-2">
              <Button
                variant="outline"
                onClick={handleSaveDraft}
                disabled={stage === "committed"}
                aria-label="임시 저장"
              >
                {"임시 저장"}
              </Button>
              <Button
                className="bg-emerald-600 hover:bg-emerald-700"
                onClick={() => setSubmitDialogOpen(true)}
                aria-label="검사 결과 제출"
                disabled={stage === "committed"}
              >
                {"제출"}
              </Button>
            </div>
            {lastDraftSavedAt && (
              <span className="text-xs text-muted-foreground">
                {`임시 저장됨 · ${new Date(lastDraftSavedAt).toLocaleTimeString("ko-KR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}`}
              </span>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-screen-sm px-4 pb-28 pt-4 space-y-4">
        {stage === "in-progress" && (
          <div className="flex items-center gap-2 text-xs text-rose-700" role="status" aria-live="polite">
            <span className="inline-block w-2 h-2 rounded-full bg-rose-600" aria-hidden="true" />
            <span>{"검사 중 · 로컬에 자동 저장됩니다."}</span>
            {totalItems > 0 && (
              <span className="text-gray-600">
                {`(${processedCount}건 처리됨 · ${remainingItems}건 남음${isInspectionComplete ? " · 검사 완료" : ""})`}
              </span>
            )}
          </div>
        )}

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
            <Card>
              <CardContent className="py-3 space-y-3">
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
                    variant={showUpdatedOnly ? "default" : "outline"}
                    onClick={() => setShowUpdatedOnly((v) => !v)}
                    aria-pressed={showUpdatedOnly}
                  >
                    {"검사 후 수정"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={openStickerDialog}>
                    <Tag className="size-4 mr-1" />
                    {"스티커 미부착"}
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <Filter className="size-4 text-gray-400" />
                  <SearchBar
                    value={query}
                    onChange={setQuery}
                    placeholder="식별번호 또는 이름 검색"
                    rightIcon={<Search className="size-4 text-gray-500" aria-hidden="true" />}
                  />
                </div>
              </CardContent>
            </Card>

            <section aria-labelledby="list-section" className="mt-4">
              <h2 id="list-section" className="sr-only">
                {"목록"}
              </h2>
              {itemGroups.length === 0 ? (
                <Card>
                  <CardContent className="py-6 text-center text-sm text-muted-foreground">
                    {"조건에 해당하는 물품이 없습니다."}
                  </CardContent>
                </Card>
              ) : (
                <InspectionItemList
                  groups={itemGroups}
                  onPass={markPass}
                  onWarn={markWarn}
                  onDiscard={markDiscardExpired}
                />
              )}
            </section>
          </>
        ) : (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 flex-1">
                  {"검사 결과"}
                  <Badge variant="secondary" className="ml-auto">
                    {summaryFromServer.reduce((sum, entry) => sum + entry.count, 0)}건
                  </Badge>
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2 text-xs">
                <button
                  type="button"
                  className={`rounded-full border px-3 py-1 ${filter === "ALL" ? "border-emerald-400 text-emerald-700" : "text-muted-foreground"}`}
                  onClick={() => setFilter("ALL")}
                >
                  전체
                </button>
                {summaryFromServer.map((entry) => (
                  <button
                    key={entry.action}
                    type="button"
                    className={`rounded-full border px-3 py-1 ${
                      filter === entry.action ? "border-emerald-400 text-emerald-700" : "text-muted-foreground"
                    }`}
                    onClick={() => setFilter(entry.action)}
                  >
                    {`${ACTION_LABEL[entry.action]} ${entry.count}건`}
                  </button>
                ))}
              </div>

              {groupedResults.groups.length === 0 && groupedResults.singles.length === 0 ? (
                <p className="text-sm text-muted-foreground">{"해당 조건의 결과가 없습니다."}</p>
              ) : (
                <div className="space-y-3">
                  {groupedResults.groups.map((group) => (
                    <div key={group.bundleId} className="rounded-md border p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm font-semibold text-gray-900">{group.bundleName}</div>
                        <div className="flex items-center gap-2 text-xs">
                          {group.bundleLabel && (
                            <Badge variant="outline" className="border-gray-200">
                              {group.bundleLabel}
                            </Badge>
                          )}
                          <Badge variant="secondary" className="bg-emerald-50 text-emerald-700">
                            {group.entries.length}건
                          </Badge>
                        </div>
                      </div>
                      <div className="mt-2 space-y-2">
                        {group.entries.map((entry) => (
                          <ResultEntryView
                            key={entry.id}
                            entry={entry}
                            compact
                            onRestart={entry.actionRecordId ? handleRestartEntry : undefined}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                  {groupedResults.singles.map((entry) => (
                    <ResultEntryView
                      key={entry.id}
                      entry={entry}
                      onRestart={entry.actionRecordId ? handleRestartEntry : undefined}
                    />
                  ))}
                </div>
              )}
              {stage === "committed" && session.actions?.length ? (
                <div className="mt-5 space-y-3 rounded-md border border-slate-200 px-3 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-slate-900">제출된 조치 상세</h3>
                    <Badge variant="outline" className="border-slate-200 text-slate-600">
                      {`${session.actions.length}건`}
                    </Badge>
                  </div>
                  <div className="space-y-3 text-xs text-slate-600">
                    {session.actions.map((action) => {
                      const recordedAt = new Date(action.recordedAt)
                      const recordedLabel = Number.isNaN(recordedAt.getTime())
                        ? "시간 정보 없음"
                        : `${formatShortDate(recordedAt)} ${recordedAt.toLocaleTimeString("ko-KR", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}`
                      const style = ACTION_ICON_COLOR[action.actionType]
                      const penaltyCount = action.penalties.length
                      return (
                        <div key={action.actionId} className="rounded-md border border-slate-200 bg-white px-3 py-3">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <span
                                className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${style.bg} ${style.text}`}
                              >
                                {ACTION_LABEL[action.actionType]}
                              </span>
                              <span className="font-medium text-slate-900">{recordedLabel}</span>
                            </div>
                          </div>
                          {action.note && (
                            <p className="mt-2 text-[13px] text-slate-700 whitespace-pre-wrap">{action.note}</p>
                          )}
                          {action.items.length > 0 && (
                            <div className="mt-3 space-y-1">
                              <p className="text-[11px] font-medium text-slate-500">스냅샷</p>
                              <ul className="space-y-1 text-[11px] text-slate-600">
                                {action.items.map((item) => (
                                  <li key={item.id} className="flex flex-wrap items-center gap-2">
                                    <span className="font-medium text-slate-700">{item.snapshotName ?? "무제"}</span>
                                    {item.snapshotExpiresOn && (
                                      <span className="text-slate-500">{`유통기한 ${item.snapshotExpiresOn}`}</span>
                                    )}
                                    {typeof item.quantityAtAction === "number" && (
                                      <span className="text-slate-500">{`수량 ${item.quantityAtAction}`}</span>
                                    )}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {penaltyCount > 0 && (
                            <div className="mt-3 space-y-1">
                              <p className="text-[11px] font-medium text-rose-600">{`벌점 ${penaltyCount}건`}</p>
                              <ul className="space-y-1 text-[11px] text-rose-600">
                                {action.penalties.map((penalty) => (
                                  <li key={penalty.id} className="flex flex-wrap items-center gap-2">
                                    <span>{`${penalty.points}점`}</span>
                                    {penalty.reason && <span className="text-rose-500">{penalty.reason}</span>}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={stickerDialogOpen} onOpenChange={setStickerDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{"스티커 미부착 물품 폐기"}</DialogTitle>
            <DialogDescription>{"발견한 미등록 물품 정보를 간단히 입력해 주세요."}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid gap-1.5">
              <Label htmlFor="sticker-name">{"물품 설명"}</Label>
              <Input
                id="sticker-name"
                value={stickerName}
                onChange={(event) => setStickerName(event.target.value)}
                placeholder="예: 무(無)표기 반찬통"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setStickerDialogOpen(false)}>
                {"취소"}
              </Button>
              <Button onClick={handleStickerSubmit} disabled={!stickerName.trim()}>
                <Trash2 className="mr-1 size-4" />
                {"폐기"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={submitDialogOpen}
        onOpenChange={(open) => {
          if (!submitting) {
            setSubmitDialogOpen(open)
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{"검사 결과 제출 요약"}</DialogTitle>
            <DialogDescription>{"제출 전 조치 요약을 확인해 주세요. 제출 즉시 관련 알림이 발송됩니다."}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800">
              <div className="flex items-center justify-between py-0.5">
                <span>{"경고 조치"}</span>
                <span className="font-semibold text-amber-700">{`${summaryMetrics.warnCount}건`}</span>
              </div>
              <div className="flex items-center justify-between py-0.5">
                <span>{"등록 폐기"}</span>
                <span className="font-semibold text-rose-700">{`${summaryMetrics.registeredDisposalCount}건`}</span>
              </div>
              <div className="flex items-center justify-between py-0.5">
                <span>{"미등록 폐기"}</span>
                <span className="font-semibold text-rose-700">{`${summaryMetrics.unregisteredDisposalCount}건`}</span>
              </div>
              <div className="flex items-center justify-between py-0.5">
                <span>{"통과"}</span>
                <span className="font-semibold text-emerald-700">{`${summaryMetrics.passCount}건`}</span>
              </div>
            </div>
            {summaryMetrics.totalActions === 0 && (
              <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                {"기록된 조치가 없습니다. 그래도 제출하시겠습니까?"}
              </p>
            )}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
              {remainingItems > 0 && (
                <p className="text-xs text-rose-600">
                  {"검사하지 않은 물품이 남아 있어 제출할 수 없습니다."}
                </p>
              )}
              <Button variant="outline" onClick={() => setSubmitDialogOpen(false)} disabled={submitting}>
                {"돌아가기"}
              </Button>
              <Button onClick={() => void finalizeInspection()} disabled={submitting || remainingItems > 0}>
                {submitting ? <Loader2 className="mr-1 size-4 animate-spin" aria-hidden /> : <Check className="mr-1 size-4" />}
                {"제출"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{"검사를 취소할까요?"}</DialogTitle>
            <DialogDescription>{"취소하면 기록되지 않은 입력 내용이 모두 사라집니다."}</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setCancelOpen(false)}>
              {"돌아가기"}
            </Button>
            <Button variant="destructive" onClick={() => void handleCancelSession()}>
              <RotateCcw className="mr-1 size-4" />
              {"검사 취소"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  )
}

function InspectionItemList({
  groups,
  onPass,
  onWarn,
  onDiscard,
}: {
  groups: ItemGroup[]
  onPass: (item: Item) => void
  onWarn: (item: Item, action: "WARN_INFO_MISMATCH" | "WARN_STORAGE_POOR") => void
  onDiscard: (item: Item) => void
}) {
  if (groups.length === 0) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-sm text-muted-foreground">
          {"검사할 물품이 없습니다."}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      {groups.map((group) => (
        <div key={group.bundleId} className="space-y-2 rounded-md border p-2">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">
              {group.bundleName}
              {group.bundleLabel && (
                <span className="ml-2 text-xs text-muted-foreground">{group.bundleLabel}</span>
              )}
            </div>
            <Badge variant="outline">{`${group.items.length}개`}</Badge>
          </div>
          <div className="space-y-2">
            {group.items.map((item) => (
              <InspectionItemCard
                key={item.unitId}
                item={item}
                onPass={onPass}
                onWarn={onWarn}
                onDiscard={onDiscard}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function InspectionItemCard({
  item,
  onPass,
  onWarn,
  onDiscard,
}: {
  item: Item
  onPass: (item: Item) => void
  onWarn: (item: Item, action: "WARN_INFO_MISMATCH" | "WARN_STORAGE_POOR") => void
  onDiscard: (item: Item) => void
}) {
  const detailLine = `${item.bundleLabelDisplay ?? item.displayLabel ?? formatStickerLabel(item.slotIndex, item.labelNumber)} • ${formatShortDate(item.expiryDate)}`
  const daysUntilExpiry = daysLeft(item.expiryDate)
  const isExpired = !Number.isNaN(daysUntilExpiry) && daysUntilExpiry < 0
  return (
    <Card>
      <CardContent className="py-3 px-3">
        <div className="flex w-full items-center gap-3">
          <div className="flex items-center gap-1 shrink-0">
            {!isExpired ? (
              <WarnMenu
                onSelect={(type) =>
                  onWarn(item, type === "warn_storage" ? "WARN_STORAGE_POOR" : "WARN_INFO_MISMATCH")
                }
              />
            ) : null}
            {isExpired ? (
              <Button variant="destructive" size="sm" onClick={() => onDiscard(item)}>
                <Trash2 className="size-4 mr-1" />
                {"폐기"}
              </Button>
            ) : null}
          </div>
          <div className="flex-1 min-w-0 text-center sm:text-left">
            <div className="text-base font-semibold text-gray-900">{item.name}</div>
            <div className="text-sm text-muted-foreground">{detailLine}</div>
          </div>
          {!isExpired && (
            <div className="shrink-0">
              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => onPass(item)}>
                <Check className="size-4 mr-1" />
                {"통과"}
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function ResultEntryView({
  entry,
  compact = false,
  onRestart,
}: {
  entry: ResultEntry
  compact?: boolean
  onRestart?: (entry: ResultEntry) => void
}) {
  const actionStyle = ACTION_ICON_COLOR[entry.action]
  const recordedDate = entry.recordedAt ? new Date(entry.recordedAt) : new Date(entry.time)
  const recordedAt = Number.isNaN(recordedDate.getTime()) ? new Date(entry.time) : recordedDate
  const recordedLabel = `${formatShortDate(recordedAt)} ${recordedAt.toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  })}`

  return (
    <div className={`rounded-md border ${compact ? "px-3 py-2" : "px-3 py-3"} text-sm`} role="listitem">
      <div className="flex items-start gap-3">
        {onRestart ? (
          <Button
            variant={entry.itemId ? "outline" : "destructive"}
            size="icon"
            className={entry.itemId ? "h-8 w-8 shrink-0 border-amber-300 text-amber-600" : "h-8 w-8 shrink-0"}
            aria-label={entry.itemId ? "검사 전에 상태로 되돌리기" : "조치를 삭제"}
            onClick={() => onRestart(entry)}
          >
            {entry.itemId ? <RotateCcw className="size-4" /> : <Trash2 className="size-4" />}
          </Button>
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-gray-900 truncate">
            {entry.name ?? ACTION_LABEL[entry.action]}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {recordedLabel}
            {entry.bundleLabel && !compact ? ` · ${entry.bundleLabel}` : ""}
          </div>
          {entry.note && <p className="mt-1 text-xs text-muted-foreground">{entry.note}</p>}
          {typeof entry.penaltyCount === "number" && entry.penaltyCount > 0 && (
            <p className="mt-1 text-xs text-rose-600">{`벌점 ${entry.penaltyCount}건`}</p>
          )}
        </div>
        <span
          className={`inline-flex shrink-0 items-center rounded-md px-2 py-1 text-xs font-medium ${actionStyle.bg} ${actionStyle.text}`}
        >
          {ACTION_LABEL[entry.action]}
        </span>
      </div>
    </div>
  )
}

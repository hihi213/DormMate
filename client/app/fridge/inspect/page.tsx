"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  ClipboardCheck,
  Filter,
  Loader2,
  Search,
  Tag,
  Trash2,
  X,
  Check,
  RotateCcw,
} from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import SearchBar from "@/features/fridge/components/search-bar"
import WarnMenu from "@/features/fridge/components/warn-menu"
import StatusBadge from "@/components/shared/status-badge"
import type { Item } from "@/features/fridge/types"
import type { InspectionAction, InspectionSession } from "@/features/inspections/types"
import {
  fetchActiveInspection,
  fetchInspection,
  recordInspectionActions,
  submitInspection,
} from "@/features/inspections/api"
import { getCurrentUser } from "@/lib/auth"
import { daysLeft, ddayLabel, formatShortDate } from "@/lib/date-utils"

type Stage = "idle" | "in-progress" | "committed"

type ResultEntry = {
  id: string
  time: number
  action: InspectionAction
  itemId?: string
  bundleId?: string
  bundleLabel?: string
  bundleName?: string
  expiry?: string
  name?: string
  note?: string
}

type FilterType = "ALL" | InspectionAction

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
  const [results, setResults] = useState<ResultEntry[]>([])
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [stickerDialogOpen, setStickerDialogOpen] = useState(false)
  const [stickerName, setStickerName] = useState("")

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
        const sessionId = sessionIdParam ? Number(sessionIdParam) : undefined
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

  const items = useMemo(() => session?.items ?? [], [session])
  const totalItems = items.length
  const processedRegisteredItems = results.filter((r) => r.itemId).length
  const remainingItems = Math.max(totalItems - processedRegisteredItems, 0)
  const isInspectionComplete = remainingItems === 0 && totalItems > 0

  const filteredItems = useMemo(() => {
    let list: Item[] = items
    if (showExpired) {
      list = list.filter((item) => daysLeft(item.expiry) < 0)
    }
    if (query.trim()) {
      const q = query.trim().toLowerCase()
      list = list.filter((item) => {
        const haystack = `${item.bundleLabelDisplay ?? ""} ${item.bundleName ?? ""} ${item.name ?? ""}`.toLowerCase()
        return haystack.includes(q)
      })
    }
    return list
  }, [items, showExpired, query])

  const grouped = useMemo(() => {
    const map = new Map<string, Item[]>()
    for (const it of filteredItems) {
      if (!map.has(it.bundleId)) map.set(it.bundleId, [])
      map.get(it.bundleId)!.push(it)
    }
    const groups = Array.from(map.values()).map((grp) => grp.slice().sort((a, b) => a.seqNo - b.seqNo))
    groups.sort((a, b) => a.expiry.localeCompare(b.expiry))
    return groups
  }, [filteredItems])

  const singles = useMemo(() => grouped.filter((grp) => grp.length === 1).map((grp) => grp[0]), [grouped])
  const bundles = useMemo(() => grouped.filter((grp) => grp.length > 1), [grouped])

  const filteredResults = useMemo(() => {
    if (filter === "ALL") return results
    return results.filter((entry) => entry.action === filter)
  }, [filter, results])

  const summaryFromServer = session?.summary ?? []

  const addResult = (entry: Omit<ResultEntry, "id" | "time">) => {
    setResults((prev) => [
      { id: `R-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, time: Date.now(), ...entry },
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
      const response = await recordInspectionActions(session.sessionId, [
        {
          action: payload.action,
          itemId: payload.item?.unitId ?? null,
          bundleId: payload.item?.bundleId ?? null,
          note: payload.note ?? null,
        },
      ])
      setSession(response)
      if (payload.item) {
        addResult({
          action: payload.action,
          itemId: payload.item.unitId,
          bundleId: payload.item.bundleId,
          bundleLabel: payload.item.bundleLabelDisplay,
          bundleName: payload.item.bundleName,
          expiry: payload.item.expiry,
          name: payload.item.name,
          note: payload.note,
        })
      } else {
        addResult({
          action: payload.action,
          note: payload.note,
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

  const finalizeInspection = async () => {
    if (!session) return
    try {
      const response = await submitInspection(session.sessionId, {})
      setSession(response)
      setStage("committed")
      toast({
        title: "검사 결과가 제출되었습니다.",
      })
      router.replace("/fridge/inspections")
    } catch (err) {
      const message = err instanceof Error ? err.message : "검사 제출에 실패했습니다."
      toast({
        title: "검사 제출 실패",
        description: message,
        variant: "destructive",
      })
    }
  }

  const handleCancelSession = async () => {
    if (!session) return
    router.replace("/fridge/inspections")
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
              <h1 className="text-base font-semibold leading-none">{`냉장고 검사 · ${session.slotCode}`}</h1>
            </div>
          </div>
          <div className="inline-flex items-center gap-1">
            <Button
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={() => {
                if (results.length === 0) setConfirmOpen(true)
                else void finalizeInspection()
              }}
              aria-label="검사 결과 제출"
              disabled={stage === "committed"}
            >
              {"제출"}
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-screen-sm px-4 pb-28 pt-4 space-y-4">
        {stage === "in-progress" && (
          <div className="flex items-center gap-2 text-xs text-rose-700" role="status" aria-live="polite">
            <span className="inline-block w-2 h-2 rounded-full bg-rose-600" aria-hidden="true" />
            <span>{"검사 중 · 서버에 자동 저장됩니다."}</span>
            {totalItems > 0 && (
              <span className="text-gray-600">
                {`(${processedRegisteredItems}건 처리됨 · ${remainingItems}건 남음${isInspectionComplete ? " · 검사 완료" : ""})`}
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
              {filteredItems.length === 0 ? (
                <Card>
                  <CardContent className="py-6 text-center text-sm text-muted-foreground">
                    {"조건에 해당하는 물품이 없습니다."}
                  </CardContent>
                </Card>
              ) : (
                <InspectionItemList
                  singles={singles}
                  bundles={bundles}
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
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                {"검사 결과"}
                <Badge variant="secondary" className="ml-auto">
                  {summaryFromServer.reduce((sum, entry) => sum + entry.count, 0)}건
                </Badge>
              </CardTitle>
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

              {filteredResults.length === 0 ? (
                <p className="text-sm text-muted-foreground">{"해당 조건의 결과가 없습니다."}</p>
              ) : (
                <ul className="space-y-2">
                  {filteredResults.map((entry) => (
                    <li key={entry.id} className="rounded-md border p-3 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <div className="font-semibold text-gray-900">{ACTION_LABEL[entry.action]}</div>
                          <div className="text-xs text-muted-foreground">
                            {formatShortDate(new Date(entry.time).toISOString())}
                          </div>
                        </div>
                        <span
                          className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${
                            ACTION_ICON_COLOR[entry.action].bg
                          } ${ACTION_ICON_COLOR[entry.action].text}`}
                        >
                          {ACTION_LABEL[entry.action]}
                        </span>
                      </div>
                      {entry.name && (
                        <p className="mt-2 text-sm text-gray-800">
                          {entry.name}
                          {entry.bundleLabel && <span className="text-muted-foreground">{` · ${entry.bundleLabel}`}</span>}
                        </p>
                      )}
                      {entry.note && <p className="mt-1 text-xs text-muted-foreground">{entry.note}</p>}
                    </li>
                  ))}
                </ul>
              )}
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

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{"검사 결과를 제출할까요?"}</DialogTitle>
            <DialogDescription>{"제출 후에는 조치 결과가 즉시 알림으로 발송됩니다."}</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              {"돌아가기"}
            </Button>
            <Button onClick={() => void finalizeInspection()}>
              <Check className="mr-1 size-4" />
              {"제출"}
            </Button>
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
  singles,
  bundles,
  onPass,
  onWarn,
  onDiscard,
}: {
  singles: Item[]
  bundles: Item[][]
  onPass: (item: Item) => void
  onWarn: (item: Item, action: "WARN_INFO_MISMATCH" | "WARN_STORAGE_POOR") => void
  onDiscard: (item: Item) => void
}) {
  if (singles.length === 0 && bundles.length === 0) {
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
      {singles.map((item) => (
        <InspectionItemCard
          key={item.unitId}
          item={item}
          onPass={onPass}
          onWarn={onWarn}
          onDiscard={onDiscard}
        />
      ))}
      {bundles.map((group) => (
        <div key={group[0].bundleId} className="space-y-2 rounded-md border p-2">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">
              {group[0].bundleName}
              {group[0].bundleLabelDisplay && (
                <span className="ml-2 text-xs text-muted-foreground">{group[0].bundleLabelDisplay}</span>
              )}
            </div>
            <Badge variant="outline">{`${group.length}개`}</Badge>
          </div>
          <div className="space-y-2">
            {group.map((item) => (
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
  const d = daysLeft(item.expiry)
  const status = d < 0 ? "expired" : d <= 3 ? "expiring" : "ok"
  const detailLine = `${item.bundleLabelDisplay ?? item.displayCode ?? item.slotCode} • ${formatShortDate(item.expiry)}`
  return (
    <Card>
      <CardContent className="py-3 px-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-gray-900">{item.name}</div>
            <div className="text-xs text-muted-foreground">{detailLine}</div>
          </div>
          <div className="flex items-center gap-2">
            <WarnMenu
              onSelect={(type) => onWarn(item, type === "warn_storage" ? "WARN_STORAGE_POOR" : "WARN_INFO_MISMATCH")}
            />
            <Button variant="destructive" size="sm" onClick={() => onDiscard(item)}>
              <Trash2 className="size-4 mr-1" />
              {"폐기"}
            </Button>
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => onPass(item)}>
              <Check className="size-4 mr-1" />
              {"통과"}
            </Button>
          </div>
          <StatusBadge status={status} />
        </div>
      </CardContent>
    </Card>
  )
}


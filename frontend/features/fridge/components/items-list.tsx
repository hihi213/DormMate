"use client"

import { useMemo, memo, useState } from "react"
import type { Item } from "@/features/fridge/types"
import { Card, CardContent } from "@/components/ui/card"
import SwipeableCard from "./swipeable-card"
import { Loader2, Trash2 } from "lucide-react"
import { getCurrentUserId } from "@/lib/auth"
import { useToast } from "@/hooks/use-toast"
import { useFridge } from "@/features/fridge/hooks/fridge-context"
import StatusBadge from "@/components/shared/status-badge"
import { earliestDays, resolveStatus } from "@/lib/fridge-logic"

type ItemsListProps = {
  items?: Item[]
  onOpenBundle?: (bundleId: string, opts?: { edit?: boolean; unitId?: string }) => void
}

export default function ItemsList({ items = [], onOpenBundle }: ItemsListProps) {
  const grouped = useMemo(() => {
    const map = new Map<string, Item[]>()
    for (const it of items) {
      if (!map.has(it.bundleId)) map.set(it.bundleId, [])
      map.get(it.bundleId)!.push(it)
    }
    const groups = Array.from(map.values()).map((grp) => grp.slice().sort((a, b) => a.seqNo - b.seqNo))
    groups.sort((a, b) => earliestDays(a) - earliestDays(b))
    return groups
  }, [items])

  const singles = useMemo(() => grouped.filter((grp) => grp.length === 1).map((grp) => grp[0]), [grouped])
  const bundles = useMemo(() => grouped.filter((grp) => grp.length > 1), [grouped])

  if (singles.length === 0 && bundles.length === 0) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-sm text-muted-foreground">
          {"조건에 해당하는 물품이 없습니다."}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      <MergedByUrgency singles={singles} bundles={bundles} onOpenBundle={onOpenBundle} />
    </div>
  )
}

/**
 * Merge singles and bundle groups into one list by urgency (using expiry order already sorted).
 * Bundle urgency = earliest item in the group.
 */
function MergedByUrgency({
  singles,
  bundles,
  onOpenBundle,
}: {
  singles: Item[]
  bundles: Item[][]
  onOpenBundle?: (bundleId: string, opts?: { edit?: boolean; unitId?: string }) => void
}) {
  const { deleteBundle, isSlotActive } = useFridge()
  const { toast } = useToast()
  const uid = getCurrentUserId()
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

  // Build typed list
  type Row = { kind: "single"; item: Item } | { kind: "bundle"; items: Item[] }
  const rows: Row[] = []

  let i = 0,
    j = 0
  const singlesLen = singles.length
  const bundlesLen = bundles.length

  // Two-pointer merge by soonest expiry
  while (i < singlesLen || j < bundlesLen) {
    if (i >= singlesLen) {
      rows.push({ kind: "bundle", items: bundles[j++] })
    } else if (j >= bundlesLen) {
      rows.push({ kind: "single", item: singles[i++] })
    } else {
      if (singles[i].expiryDate <= bundles[j][0].expiryDate) rows.push({ kind: "single", item: singles[i++] })
      else rows.push({ kind: "bundle", items: bundles[j++] })
    }
  }

  return (
    <div className="space-y-3">
      {rows.map((row) => {
        if (row.kind === "single") {
          const it = row.item
          const status = resolveStatus(it.expiryDate, it.freshness)
          const isMine = it.ownerId ? uid === it.ownerId : it.owner === "me"
          const slotActive = isSlotActive(it.slotId)

          return (
            <SwipeableCard
              key={it.unitId}
              onClick={() => it.bundleId && onOpenBundle?.(it.bundleId, { unitId: it.unitId })}
              className="rounded-md border bg-white"
              revealWidth={56}
              actions={
                <button
                  type="button"
                  className="inline-flex items-center justify-center h-9 w-9 rounded-md border text-rose-600 bg-white"
                  onClick={async (e) => {
                    e.stopPropagation()
                    if (!isMine || pendingDeleteId) return
                    if (!it.bundleId) return
                    if (!slotActive) {
                      toast({
                        title: "삭제할 수 없습니다",
                        description: "해당 칸이 점검 중이거나 일시 중지되었습니다.",
                        variant: "destructive",
                      })
                      return
                    }
                    if (
                      !confirm(
                        "선택한 포장을 삭제할까요? 포장 내 모든 물품과 라벨이 함께 삭제됩니다. (되돌릴 수 없음)",
                      )
                    )
                      return
                    setPendingDeleteId(it.bundleId)
                    const result = await deleteBundle(it.bundleId)
                    setPendingDeleteId(null)
                    if (result.success) {
                      toast({
                        title: "삭제됨",
                        description: `${it.bundleLabelDisplay || it.displayLabel} 포장이 삭제되었습니다.`,
                      })
                    } else {
                      toast({
                        title: "삭제 실패",
                        description: result.error ?? "물품 삭제 중 오류가 발생했습니다.",
                        variant: "destructive",
                      })
                    }
                  }}
                  disabled={!isMine || pendingDeleteId === it.bundleId || !slotActive}
                  aria-label="삭제"
                  title="삭제"
                >
                  {pendingDeleteId === it.bundleId ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : (
                    <Trash2 className="size-4" />
                  )}
                </button>
              }
            >
              <MemoItemCard name={it.name} status={status} isBundle={false} bundleCount={0} isMine={isMine} />
            </SwipeableCard>
          )
        } else {
          const grp = row.items
          const first = grp[0]
          const bundleName = first.bundleName
          const status = resolveStatus(grp[0].expiryDate, grp[0].freshness) // earliest after sort
          const count = grp.length
          const isMine = first.ownerId ? uid === first.ownerId : false
          const slotActive = isSlotActive(first.slotId)

          return (
            <SwipeableCard
              key={first.bundleId}
              onClick={() => first.bundleId && onOpenBundle?.(first.bundleId)}
              className="rounded-md border bg-white"
              revealWidth={56}
              actions={
                <button
                  type="button"
                  className="inline-flex items-center justify-center h-9 w-9 rounded-md border text-rose-600 bg-white"
                  onClick={async (e) => {
                    e.stopPropagation()
                    if (!isMine || pendingDeleteId) return
                    if (!first.bundleId) return
                    if (!slotActive) {
                      toast({
                        title: "삭제할 수 없습니다",
                        description: "해당 칸이 점검 중이거나 일시 중지되었습니다.",
                        variant: "destructive",
                      })
                      return
                    }
                    if (!confirm(`묶음 ${first.bundleLabelDisplay || first.bundleName || ""} (총 ${count})을 삭제할까요?`))
                      return
                    const deleteKey = first.bundleId
                    setPendingDeleteId(deleteKey)
                    const result = await deleteBundle(first.bundleId)
                    setPendingDeleteId(null)
                    if (result.success) {
                      toast({
                        title: "삭제됨",
                        description: `묶음 ${first.bundleLabelDisplay || first.bundleName || ""} (총 ${count})이 삭제되었습니다.`,
                      })
                    } else {
                      toast({
                        title: "삭제 실패",
                        description: result.error ?? "묶음을 삭제하는 중 오류가 발생했습니다.",
                        variant: "destructive",
                      })
                    }
                  }}
                  disabled={!isMine || pendingDeleteId === first.bundleId || !slotActive}
                  aria-label="묶음 삭제"
                  title="묶음 삭제"
                >
                  {pendingDeleteId === first.bundleId ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : (
                    <Trash2 className="size-4" />
                  )}
                </button>
              }
            >
              <MemoItemCard name={bundleName} status={status} isBundle bundleCount={count} isMine={isMine} />
            </SwipeableCard>
          )
        }
      })}
    </div>
  )
}

/**
 * Unified "물품 카드"
 * - Primary: name
 * - Secondary tags order: owner tag first, then bundle tag
 * - Status badge on the right
 */
function ItemCard({
  name,
  status,
  isBundle = false,
  bundleCount = 0,
  isMine = false,
}: {
  name: string
  status: "expired" | "expiring" | "ok"
  isBundle?: boolean
  bundleCount?: number
  isMine?: boolean
}) {
  return (
    <Card className="border-0 shadow-none">
      <CardContent className="py-3 px-3">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-sm sm:text-base font-semibold truncate">{name}</div>
            <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
              {isMine && (
                <span className="inline-flex items-center rounded-md border px-1.5 py-0.5 bg-white">{"내 물품"}</span>
              )}
              {isBundle && (
                <span className="inline-flex items-center rounded-md border px-1.5 py-0.5 bg-white">{`묶음 · ${bundleCount}`}</span>
              )}
            </div>
          </div>
          <div className="shrink-0">
            <StatusBadge status={status} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
const MemoItemCard = memo(ItemCard)

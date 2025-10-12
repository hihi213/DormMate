"use client"

import { useMemo, memo } from "react"
import type { Item } from "./types"
import { Card, CardContent } from "@/components/ui/card"
import SwipeableCard from "./swipeable-card"
import { Trash2 } from "lucide-react"
import { getCurrentUserId } from "@/lib/auth"
import { useToast } from "@/hooks/use-toast"
import { useFridge } from "./fridge-context"
import StatusBadge from "@/components/shared/status-badge"
import { earliestDays, getBundleName, resolveStatus } from "@/lib/fridge-logic"

type ItemsListProps = {
  items?: Item[]
  onOpenItem?: (id: string, opts?: { edit?: boolean }) => void
  onOpenBundle?: (bundleId: string, opts?: { edit?: boolean }) => void
}

export default function ItemsList({ items = [], onOpenItem, onOpenBundle }: ItemsListProps) {
  // Group by bundleId presence
  const singles = useMemo(() => items.filter((i) => !i.bundleId), [items])

  // Map bundleId -> items[]
  const bundles = useMemo(() => {
    const map = new Map<string, Item[]>()
    for (const it of items) {
      if (!it.bundleId) continue
      if (!map.has(it.bundleId)) map.set(it.bundleId, [])
      map.get(it.bundleId)!.push(it)
    }
    // Sort inner items by urgency asc
    const groups = Array.from(map.values()).map((grp) => grp.slice().sort((a, b) => a.expiry.localeCompare(b.expiry)))
    // Sort bundles by earliest urgency asc
    groups.sort((a, b) => earliestDays(a) - earliestDays(b))
    return groups
  }, [items])

  // Sort singles by expiry asc
  const singlesSorted = useMemo(() => singles.slice().sort((a, b) => a.expiry.localeCompare(b.expiry)), [singles])

  if (singlesSorted.length === 0 && bundles.length === 0) {
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
      <MergedByUrgency singles={singlesSorted} bundles={bundles} onOpenItem={onOpenItem} onOpenBundle={onOpenBundle} />
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
  onOpenItem,
  onOpenBundle,
}: {
  singles: Item[]
  bundles: Item[][]
  onOpenItem?: (id: string, opts?: { edit?: boolean }) => void
  onOpenBundle?: (bundleId: string, opts?: { edit?: boolean }) => void
}) {
  const { deleteItem } = useFridge()
  const { toast } = useToast()
  const uid = getCurrentUserId()

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
      if (singles[i].expiry <= bundles[j][0].expiry) rows.push({ kind: "single", item: singles[i++] })
      else rows.push({ kind: "bundle", items: bundles[j++] })
    }
  }

  return (
    <div className="space-y-3">
      {rows.map((row) => {
        if (row.kind === "single") {
          const it = row.item
          const status = resolveStatus(it.expiry)
          const isMine = it.ownerId ? uid === it.ownerId : it.owner === "me"

          return (
            <SwipeableCard
              key={it.id}
              onClick={() => onOpenItem?.(it.id)}
              className="rounded-md border bg-white"
              revealWidth={56}
              actions={
                <button
                  type="button"
                  className="inline-flex items-center justify-center h-9 w-9 rounded-md border text-rose-600 bg-white"
                  onClick={(e) => {
                    e.stopPropagation()
                    if (!isMine) return
                    if (confirm("해당 물품을 삭제하시겠어요? (되돌릴 수 없음)")) {
                      deleteItem(it.id)
                      toast({ title: "삭제됨", description: `${it.id} 항목이 삭제되었습니다.` })
                    }
                  }}
                  aria-label="삭제"
                  title="삭제"
                >
                  <Trash2 className="size-4" />
                </button>
              }
            >
              <MemoItemCard name={it.name} status={status} isBundle={false} bundleCount={0} isMine={isMine} />
            </SwipeableCard>
          )
        } else {
          const grp = row.items
          const first = grp[0]
          const bundleName = getBundleName(first.name)
          const status = resolveStatus(grp[0].expiry) // earliest after sort
          const count = grp.length
          const isMine = first.ownerId ? uid === first.ownerId : false

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
                  onClick={(e) => {
                    e.stopPropagation()
                    if (!isMine) return
                    if (confirm("묶음의 모든 세부 물품을 삭제할까요? (되돌릴 수 없음)")) {
                      for (const it of grp) deleteItem(it.id)
                      toast({ title: "삭제됨", description: `묶음(총 ${count})이 삭제되었습니다.` })
                    }
                  }}
                  aria-label="묶음 삭제"
                  title="묶음 삭제"
                >
                  <Trash2 className="size-4" />
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

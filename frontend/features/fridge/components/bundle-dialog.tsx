"use client"

import { useCallback, useEffect, useMemo } from "react"
import { Dialog, DialogContent, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Loader2, Trash2, X } from "lucide-react"
import { useFridge } from "@/features/fridge/hooks/fridge-context"
import type { Item } from "@/features/fridge/types"
import { useToast } from "@/hooks/use-toast"
import { getCurrentUserId } from "@/lib/auth"
import { daysLeft as calcDaysLeft } from "@/lib/date-utils"

export default function BundleDialog({
  open = false,
  onOpenChange = () => {},
  bundleId = "",
  bundleName = "",
}: {
  open?: boolean
  onOpenChange?: (v: boolean) => void
  bundleId?: string
  bundleName?: string
}) {
  const { items, deleteItem } = useFridge()
  const { toast } = useToast()
  const closeDialog = useCallback(() => onOpenChange(false), [onOpenChange])
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const sortedItems = useMemo(() => {
    if (!bundleId) return []
    return items.filter((it) => it.bundleId === bundleId).sort((a, b) => a.id.localeCompare(b.id))
  }, [items, bundleId])

  const representativeMemo = sortedItems[0]?.bundleMemo
  const groupCode = sortedItems[0]?.bundleLabelDisplay
  const ownerId = sortedItems[0]?.ownerId

  const uid = getCurrentUserId()
  const canManage = Boolean(sortedItems.length && ownerId && uid === ownerId)

  // Auto close when nothing left
  useEffect(() => {
    if (open && bundleId && sortedItems.length === 0) {
      closeDialog()
    }
  }, [open, bundleId, sortedItems.length, closeDialog])

  const handleDelete = useCallback(
    async (unitId: string) => {
      if (deletingId || !confirm("해당 세부 물품을 삭제할까요? (되돌릴 수 없음)")) return
      setDeletingId(unitId)
      const result = await deleteItem(unitId)
      setDeletingId(null)
      if (result.success) {
        toast({ title: "삭제됨", description: result.message ?? "세부 물품이 삭제되었습니다." })
      } else {
        toast({
          title: "삭제 실패",
          description: result.error ?? "세부 물품 삭제 중 오류가 발생했습니다.",
          variant: "destructive",
        })
      }
    },
    [deleteItem, toast, deletingId],
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg p-0 [&>button.absolute.right-4.top-4]:hidden [&_button[aria-label='Close']]:hidden [&_[aria-label='Close']]:hidden [&_button[title='Close']]:hidden">
        <DialogDescription className="sr-only">
          {"묶음 상세 목록입니다. 소유자인 경우 세부 물품을 삭제할 수 있습니다."}
        </DialogDescription>

        {/* Unified header with left-top X */}
        <div className="px-3 py-2 flex items-center justify-between gap-2 border-b">
          <Button variant="ghost" size="icon" aria-label="닫기" onClick={closeDialog}>
            <X className="w-5 h-5" />
          </Button>
          <div className="text-sm font-semibold">{`묶음 상세 • ${bundleName} (${sortedItems.length})`}</div>
          <span className="w-9" aria-hidden="true" />
        </div>

        <div className="p-3">
          {groupCode && <div className="text-xs text-muted-foreground mb-1">{`대표 식별번호: ${groupCode}`}</div>}

          {representativeMemo && (
            <div className="text-xs text-muted-foreground mb-2">{`대표 메모: ${representativeMemo}`}</div>
          )}

          <ul className="space-y-2">
            {sortedItems.map((item) => (
              <BundleItemRow
                key={item.unitId}
                item={item}
                bundleName={bundleName}
                canDelete={canManage && (!item.ownerId || item.ownerId === uid)}
                isDeleting={deletingId === item.unitId}
                onDelete={handleDelete}
              />
            ))}
          </ul>

          <div className="text-xs text-muted-foreground mt-2">
            {"세부 물품은 소유자만 삭제할 수 있습니다. (마지막 항목 삭제 시 묶음도 목록에서 사라집니다)"}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function getDetailName(name: string, bundleName: string) {
  const prefix = `${bundleName} - `
  return name.startsWith(prefix) ? name.slice(prefix.length) : name
}

function formatDaysLeft(expiry: string) {
  const left = calcDaysLeft(expiry)
  if (Number.isNaN(left)) return ""
  if (left === 0) return "오늘"
  return left > 0 ? `+${left}일` : `${left}일`
}

type BundleItemRowProps = {
  item: Item
  bundleName: string
  canDelete: boolean
  isDeleting: boolean
  onDelete: (id: string) => void
}

function BundleItemRow({ item, bundleName, canDelete, isDeleting, onDelete }: BundleItemRowProps) {
  return (
    <li className="flex items-center justify-between rounded-md border p-2">
      <div>
        <div className="text-sm font-medium">{getDetailName(item.name, bundleName)}</div>
        <div className="text-xs text-muted-foreground">{formatDaysLeft(item.expiry)}</div>
      </div>
      {canDelete && (
        <Button
          variant="ghost"
          size="sm"
          className="text-rose-600"
          onClick={() => onDelete(item.unitId)}
          disabled={isDeleting}
          aria-label="세부 물품 삭제"
        >
          {isDeleting ? <Loader2 className="w-4 h-4 mr-1 animate-spin" aria-hidden /> : <Trash2 className="w-4 h-4 mr-1" />}
          {"삭제"}
        </Button>
      )}
    </li>
  )
}

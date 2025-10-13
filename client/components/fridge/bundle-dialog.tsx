"use client"

import { useEffect, useMemo } from "react"
import { Dialog, DialogContent, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Trash2, X } from "lucide-react"
import { useFridge } from "./fridge-context"
import { useToast } from "@/hooks/use-toast"
import { getCurrentUserId } from "@/lib/auth"

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

  const bundleItems = useMemo(() => items.filter((it) => it.bundleId === bundleId), [items, bundleId])
  const sorted = useMemo(() => [...bundleItems].sort((a, b) => a.id.localeCompare(b.id)), [bundleItems])
  const representativeMemo = bundleItems[0]?.memo
  const groupCode = bundleItems[0]?.groupCode

  const uid = getCurrentUserId()
  const canManage = bundleItems.length > 0 && (bundleItems[0].ownerId ? uid === bundleItems[0].ownerId : false)

  // Auto close when nothing left
  useEffect(() => {
    if (open && bundleId && bundleItems.length === 0) {
      onOpenChange(false)
    }
  }, [open, bundleId, bundleItems.length, onOpenChange])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg p-0 [&>button.absolute.right-4.top-4]:hidden [&_button[aria-label='Close']]:hidden [&_[aria-label='Close']]:hidden [&_button[title='Close']]:hidden">
        <DialogDescription className="sr-only">
          {"묶음 상세 목록입니다. 소유자인 경우 세부 물품을 삭제할 수 있습니다."}
        </DialogDescription>

        {/* Unified header with left-top X */}
        <div className="px-3 py-2 flex items-center justify-between gap-2 border-b">
          <Button variant="ghost" size="icon" aria-label="닫기" onClick={() => onOpenChange(false)}>
            <X className="w-5 h-5" />
          </Button>
          <div className="text-sm font-semibold">{`묶음 상세 • ${bundleName} (${sorted.length})`}</div>
          <span className="w-9" aria-hidden="true" />
        </div>

        <div className="p-3">
          {groupCode && <div className="text-xs text-muted-foreground mb-1">{`대표 식별번호: ${groupCode}`}</div>}

          {representativeMemo && (
            <div className="text-xs text-muted-foreground mb-2">{`대표 메모: ${representativeMemo}`}</div>
          )}

          <ul className="space-y-2">
            {sorted.map((it) => {
              const left = daysLeft(it.expiry)
              const leftText = leftLabel(left)
              const own = it.ownerId ? uid === it.ownerId : false
              return (
                <li key={it.id} className="flex items-center justify-between rounded-md border p-2">
                  <div>
                    <div className="text-sm font-medium">{getDetailName(it.name, bundleName)}</div>
                    <div className="text-xs text-muted-foreground">
                      <Badge variant="secondary" className="mr-1">
                        {it.id}
                      </Badge>
                      {leftText}
                    </div>
                  </div>
                  {own && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-rose-600"
                      onClick={() => {
                        if (confirm("해당 세부 물품을 삭제할까요? (되돌릴 수 없음)")) {
                          deleteItem(it.id)
                          toast({ title: "삭제됨", description: `${it.id} 항목이 삭제되었습니다.` })
                        }
                      }}
                      aria-label="세부 물품 삭제"
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      {"삭제"}
                    </Button>
                  )}
                </li>
              )
            })}
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
function daysLeft(dateISO: string) {
  if (!dateISO) return Number.NaN
  const today = new Date(new Date().toDateString())
  const d = new Date(dateISO)
  return Math.floor((d.getTime() - today.getTime()) / 86400000)
}
function leftLabel(n: number) {
  if (isNaN(n)) return ""
  if (n > 0) return `+${n}일`
  if (n < 0) return `${n}일`
  return "0일"
}

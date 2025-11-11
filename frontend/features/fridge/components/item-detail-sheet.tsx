"use client"

import type React from "react"

import { useEffect, useMemo, useState } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { CalendarDays, Loader2, Pencil, Trash2, X } from "lucide-react"
import { Label } from "@/components/ui/label"
import { useFridge } from "@/features/fridge/hooks/fridge-context"
import { useToast } from "@/hooks/use-toast"
import { getCurrentUser, getCurrentUserId } from "@/lib/auth"
import { Input } from "@/components/ui/input"
import { ExpiryInput } from "@/components/shared/expiry-input"
import { daysLeft, formatShortDate } from "@/lib/date-utils"
import { formatStickerLabel } from "@/features/fridge/utils/labels"
import { WARNING_EXPIRY_DAYS } from "@/features/fridge/components/add-item/constants"

export default function ItemDetailSheet({
  open = false,
  onOpenChange = () => {},
  itemId = "",
  initialEdit = false,
}: {
  open?: boolean
  onOpenChange?: (v: boolean) => void
  itemId?: string
  initialEdit?: boolean
}) {
  const { items, updateItem, deleteItem, getSlotLabel } = useFridge()
  const { toast } = useToast()
  const [edit, setEdit] = useState(initialEdit)

  useEffect(() => setEdit(initialEdit), [initialEdit])

  const it = useMemo(() => items.find((x) => x.id === itemId) || null, [items, itemId])
  const uid = getCurrentUserId()
  const currentUser = getCurrentUser()
  const canEdit = !!(it && (it.ownerId ? uid === it.ownerId : it.owner === "me"))
  const isOwner = canEdit
  const isAdmin = currentUser?.isAdmin ?? false
  const ownerInfo =
    [it?.ownerRoomNumber, it?.ownerDisplayName].filter(Boolean).join(" • ") || "소유자 정보 없음"
  const ownerLabel = isOwner ? "내 물품" : isAdmin ? ownerInfo : "타인"
  const bundleItemCount = useMemo(
    () => (it ? items.filter((candidate) => candidate.bundleId === it.bundleId).length : 0),
    [items, it?.bundleId],
  )
  const headerMemo = useMemo(() => {
    if (!it) return ""
    const memo = it.bundleMemo?.trim()
    if (isOwner) {
      return memo && memo.length > 0 ? memo : "대표 메모가 없습니다."
    }
    if (isAdmin) {
      return `${ownerInfo} 물품입니다. 대표 메모는 비공개예요.`
    }
    return "대표 메모는 소유자만 볼 수 있습니다."
  }, [it, isOwner, isAdmin, ownerInfo])
  const totalCountLabel = useMemo(() => {
    if (!it) return ""
    const count = bundleItemCount > 0 ? bundleItemCount : 0
    return `총 ${count.toLocaleString()}개`
  }, [bundleItemCount, it])

  const [form, setForm] = useState({ name: "", expiryDate: "" })
  const [saving, setSaving] = useState(false)
  const [removing, setRemoving] = useState(false)
  useEffect(() => {
    if (it) setForm({ name: it.name, expiryDate: it.expiryDate })
  }, [it])

  const d = it ? daysLeft(it.expiryDate) : Number.NaN
  const dText = isNaN(d) ? "" : ddayLabel(d)
  const statusColor = isNaN(d)
    ? "text-gray-600"
    : d < 0
      ? "text-rose-600"
      : d <= 1
        ? "text-amber-600"
        : "text-emerald-700"

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="p-0 max-h-[85svh] overflow-y-auto [&>button.absolute.right-4.top-4]:hidden"
      >
        <SheetHeader className="sr-only">
          <SheetTitle>물품 상세</SheetTitle>
          <SheetDescription>냉장고 물품 상세 및 편집 시트</SheetDescription>
        </SheetHeader>
        {/* Header */}
        <div className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b">
          <div className="px-3 py-2 flex items-center justify-between gap-2">
            <Button variant="ghost" size="icon" aria-label="닫기" onClick={() => onOpenChange(false)}>
              <X className="size-5" />
            </Button>
            <div className="text-sm font-semibold truncate">
              {it ? it.displayLabel || it.bundleLabelDisplay || "식별번호 없음" : "상세 정보"}
            </div>
            <div className="inline-flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                aria-label="삭제"
                onClick={async () => {
                  if (!it || !canEdit || removing) return
                  if (!confirm("해당 물품을 삭제하시겠어요? (되돌릴 수 없음)")) return
                  setRemoving(true)
                  const result = await deleteItem(it.unitId)
                  setRemoving(false)
                  if (result.success) {
                    toast({ title: "삭제됨", description: `${it.name} 항목이 삭제되었습니다.` })
                    onOpenChange(false)
                  } else {
                    toast({
                      title: "삭제 실패",
                      description: result.error ?? "물품 삭제 중 오류가 발생했습니다.",
                      variant: "destructive",
                    })
                  }
                }}
                disabled={!canEdit || removing}
                title={canEdit ? "삭제" : "소유자만 삭제"}
              >
                {removing ? <Loader2 className="size-4 animate-spin text-rose-600" /> : <Trash2 className="size-5 text-rose-600" />}
              </Button>
            </div>
          </div>
        </div>

        <div className="px-4 pb-6 pt-4 space-y-4">
          {!it ? (
            <p className="text-sm text-muted-foreground">{"해당 물품을 찾을 수 없습니다."}</p>
          ) : (
            <>
              {/* Summary */}
              <Card className="border-emerald-200">
                <CardContent className="py-3 space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-base font-semibold text-gray-900 flex-1 min-w-0 truncate">
                      {it.bundleName}
                    </p>
                    <Badge variant="outline" className="border-emerald-200 text-emerald-800">
                      {totalCountLabel}
                    </Badge>
                    {canEdit && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs"
                        onClick={() => setEdit((prev) => !prev)}
                      >
                        {edit ? "편집 닫기" : "정보 수정"}
                      </Button>
                    )}
                  </div>
                  <p className="text-sm text-slate-600 line-clamp-2">{headerMemo}</p>
                  <div className="text-sm">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <Field label="보관 칸" value={getSlotLabel(it.slotId, it.slotIndex)} />
                      <Field label="스티커" value={formatStickerLabel(it.slotIndex, it.labelNumber)} />
                      <Field
                        label="유통기한"
                        value={
                          <span className="inline-flex items-center gap-2">
                            <span>{formatShortDate(it.expiryDate)}</span>
                            <span className={`inline-flex items-center gap-1 text-sm ${statusColor}`}>
                              <CalendarDays className="size-4" />
                              {dText}
                            </span>
                          </span>
                        }
                      />
                      <Field label="등록일" value={formatShortDate(it.createdAt)} />
                      <Field label="소유자" value={ownerLabel} />
                      <Field
                        label="메모"
                        value={
                          isOwner
                            ? it.memo && it.memo.length > 0
                              ? it.memo
                              : "메모가 없습니다."
                            : isAdmin
                              ? `${ownerInfo} 물품입니다. 메모는 비공개예요.`
                              : "다른 사람 물품이라 가려졌어요~"
                        }
                        className="sm:col-span-2"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Edit form */}
              {edit && canEdit && (
                <Card>
                  <CardContent className="py-3 space-y-3">
                    <div className="grid gap-2">
                      <Label htmlFor="name">{"이름"}</Label>
                      <Input
                        id="name"
                        value={form.name}
                        onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                      />
                    </div>
                    <ExpiryInput
                      id="expiry"
                      label="유통기한"
                      value={form.expiryDate}
                      onChange={(next) => setForm((f) => ({ ...f, expiryDate: next }))}
                      warningThresholdDays={WARNING_EXPIRY_DAYS}
                      emphasizeToday
                      className="max-w-xs"
                      inputClassName="w-28"
                    />
                    <div className="flex justify-end">
                      <Button
                        className="bg-emerald-600 hover:bg-emerald-700"
                        onClick={async () => {
                          if (saving) return
                          const updatedName = form.name.trim() || it.name
                          setSaving(true)
                          const result = await updateItem(it.unitId, {
                            name: form.name,
                            expiryDate: form.expiryDate,
                          })
                          setSaving(false)
                          if (result.success) {
                            toast({ title: "수정 완료", description: `${updatedName} 항목이 업데이트되었습니다.` })
                            setEdit(false)
                          } else {
                            toast({
                              title: "수정 실패",
                              description: result.error ?? "물품 수정 중 오류가 발생했습니다.",
                              variant: "destructive",
                            })
                          }
                        }}
                        disabled={saving}
                      >
                        {saving && <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />}
                        {"저장"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function Field({ label, value, className = "" }: { label: string; value: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm">{value}</div>
    </div>
  )
}
function ddayLabel(n: number) {
  if (isNaN(n)) return ""
  if (n === 0) return "오늘"
  if (n > 0) return `D-${n}`
  return `D+${Math.abs(n)}`
}

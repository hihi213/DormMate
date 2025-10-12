"use client"

import type React from "react"

import { useEffect, useMemo, useState } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { CalendarDays, Pencil, Trash2, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useFridge } from "./fridge-context"
import { useToast } from "@/hooks/use-toast"
import { getCurrentUserId } from "@/lib/auth"

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
  const { items, updateItem, deleteItem } = useFridge()
  const { toast } = useToast()
  const [edit, setEdit] = useState(initialEdit)

  useEffect(() => setEdit(initialEdit), [initialEdit])

  const it = useMemo(() => items.find((x) => x.id === itemId) || null, [items, itemId])
  const uid = getCurrentUserId()
  const canEdit = !!(it && (it.ownerId ? uid === it.ownerId : it.owner === "me"))

  const [form, setForm] = useState({ name: "", expiry: "", memo: "" })
  useEffect(() => {
    if (it) setForm({ name: it.name, expiry: it.expiry, memo: it.memo || "" })
  }, [it])

  const d = it ? daysLeft(it.expiry) : Number.NaN
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
            <div className="text-sm font-semibold truncate">{it ? it.name : "상세 정보"}</div>
            <div className="inline-flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                aria-label="수정"
                onClick={() => setEdit((v) => !v)}
                disabled={!canEdit}
                title={canEdit ? "수정" : "소유자만 수정"}
              >
                <Pencil className="size-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="삭제"
                onClick={() => {
                  if (!it || !canEdit) return
                  if (confirm("해당 물품을 삭제하시겠어요? (되돌릴 수 없음)")) {
                    deleteItem(it.id)
                    toast({ title: "삭제됨", description: `${it.id} 항목이 삭제되었습니다.` })
                    onOpenChange(false)
                  }
                }}
                disabled={!canEdit}
                title={canEdit ? "삭제" : "소유자만 삭제"}
              >
                <Trash2 className="size-5 text-rose-600" />
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
                <CardContent className="py-3">
                  <div className="text-sm">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <Field label="식별번호" value={it.id} />
                      <Field
                        label="유통기한"
                        value={
                          <span className="inline-flex items-center gap-2">
                            <span>{it.expiry}</span>
                            <span className={`inline-flex items-center gap-1 text-sm ${statusColor}`}>
                              <CalendarDays className="size-4" />
                              {dText}
                            </span>
                          </span>
                        }
                      />
                      <Field label="등록일" value={new Date(it.createdAt).toLocaleDateString()} />
                      <Field label="소유자" value={it.ownerId ? (uid === it.ownerId ? "내 물품" : "타인") : it.owner} />
                      {it.memo && <Field label="메모" value={it.memo} className="sm:col-span-2" />}
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
                    <div className="grid gap-2">
                      <Label htmlFor="expiry">{"유통기한"}</Label>
                      <Input
                        id="expiry"
                        type="date"
                        value={form.expiry}
                        min={toISO(new Date())}
                        onChange={(e) => setForm((f) => ({ ...f, expiry: e.target.value }))}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="memo">{"메모(선택)"}</Label>
                      <Input
                        id="memo"
                        value={form.memo}
                        onChange={(e) => setForm((f) => ({ ...f, memo: e.target.value }))}
                      />
                    </div>
                    <div className="flex justify-end">
                      <Button
                        className="bg-emerald-600 hover:bg-emerald-700"
                        onClick={() => {
                          updateItem(it.id, { name: form.name, expiry: form.expiry, memo: form.memo || undefined })
                          toast({ title: "수정 완료", description: `${it.id} 항목이 업데이트되었습니다.` })
                          setEdit(false)
                        }}
                      >
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
function toISO(d: Date) {
  return d.toISOString().slice(0, 10)
}
function daysLeft(dateISO: string) {
  const today = new Date(new Date().toDateString())
  const d = new Date(dateISO)
  return Math.floor((d.getTime() - today.getTime()) / 86400000)
}
function ddayLabel(n: number) {
  if (isNaN(n)) return ""
  if (n === 0) return "오늘"
  if (n > 0) return `D-${n}`
  return `D+${Math.abs(n)}`
}

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

export default function BundleDetailSheet({
  open = false,
  onOpenChange = () => {},
  bundleId = "",
  initialEdit = false,
}: {
  open?: boolean
  onOpenChange?: (v: boolean) => void
  bundleId?: string
  initialEdit?: boolean
}) {
  const { items, updateItem, deleteItem } = useFridge()
  const { toast } = useToast()
  const uid = getCurrentUserId()
  const [edit, setEdit] = useState(initialEdit)
  useEffect(() => setEdit(initialEdit), [initialEdit])

  const group = useMemo(() => items.filter((x) => x.bundleId === bundleId), [items, bundleId])
  const first = group[0]
  const bundleName = getBundleName(first ? first.name : "")
  const groupCode = first ? first.groupCode : ""
  const canManage = first && first.ownerId ? uid === first.ownerId : false

  const sorted = useMemo(() => group.slice().sort((a, b) => daysLeft(a.expiry) - daysLeft(b.expiry)), [group])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="p-0 max-h-[85svh] overflow-y-auto [&>button.absolute.right-4.top-4]:hidden"
      >
        <SheetHeader className="sr-only">
          <SheetTitle>묶음 상세</SheetTitle>
          <SheetDescription>냉장고 묶음 상세 및 편집 시트</SheetDescription>
        </SheetHeader>
        {/* Header */}
        <div className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b">
          <div className="px-3 py-2 flex items-center justify-between gap-2">
            <Button variant="ghost" size="icon" aria-label="닫기" onClick={() => onOpenChange(false)}>
              <X className="size-5" />
            </Button>
            <div className="text-sm font-semibold truncate">{bundleName || "묶음 상세"}</div>
            <div className="inline-flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                aria-label="수정"
                onClick={() => setEdit((v) => !v)}
                disabled={!canManage}
                title={canManage ? "수정" : "소유자만 수정"}
              >
                <Pencil className="size-5" />
              </Button>
            </div>
          </div>
        </div>

        <div className="px-4 pb-6 pt-4 space-y-4">
          {group.length === 0 ? (
            <p className="text-sm text-muted-foreground">{"해당 묶음을 찾을 수 없습니다."}</p>
          ) : (
            <>
              <Card className="border-emerald-200">
                <CardContent className="py-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Field label="대표명" value={bundleName} />
                    {groupCode && <Field label="대표 식별번호" value={groupCode} />}
                    <Field label="총 개수" value={`${sorted.length}`} />
                    <Field label="소유자" value={canManage ? "내 물품" : "타인"} />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="py-3 space-y-2">
                  {sorted.map((it) => {
                    const d = daysLeft(it.expiry)
                    const dText = ddayLabel(d)
                    const statusColor = d < 0 ? "text-rose-600" : d <= 1 ? "text-amber-600" : "text-emerald-700"
                    const [detailName, suffix] = splitDetail(it.name, bundleName)
                    return (
                      <div key={it.id} className="rounded-md border p-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-sm font-medium truncate">{detailName}</div>
                            <div className="text-xs text-muted-foreground">{`식별번호 ${it.id}`}</div>
                            <div className={`mt-0.5 inline-flex items-center gap-1 text-sm ${statusColor}`}>
                              <CalendarDays className="size-4" />
                              <span>{`${it.expiry} • ${dText}`}</span>
                            </div>
                            {canManage && edit && (
                              <EditRow
                                value={{ name: detailName, expiry: it.expiry, memo: it.memo || "" }}
                                onSave={(v) => {
                                  const newName = suffix ? `${bundleName} - ${v.name}` : `${bundleName} - ${v.name}`
                                  updateItem(it.id, { name: newName, expiry: v.expiry, memo: v.memo || undefined })
                                  toast({ title: "수정 완료", description: `${it.id} 항목이 업데이트되었습니다.` })
                                }}
                              />
                            )}
                            {it.memo && !edit && (
                              <div className="text-xs text-muted-foreground">{`메모: ${it.memo}`}</div>
                            )}
                          </div>
                          {canManage && (
                            <div className="shrink-0 flex items-center gap-1">
                              {!edit && (
                                <Button variant="ghost" size="icon" onClick={() => setEdit(true)} aria-label="수정">
                                  <Pencil className="size-4" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-rose-600"
                                onClick={() => {
                                  if (confirm("해당 세부 물품을 삭제할까요? (되돌릴 수 없음)")) {
                                    deleteItem(it.id)
                                    toast({ title: "삭제됨", description: `${it.id} 항목이 삭제되었습니다.` })
                                  }
                                }}
                                aria-label="삭제"
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm">{value}</div>
    </div>
  )
}
function EditRow({
  value,
  onSave = () => {},
}: {
  value: { name: string; expiry: string; memo: string }
  onSave?: (v: { name: string; expiry: string; memo: string }) => void
}) {
  const [v, setV] = useState(value)
  useEffect(() => setV(value), [value])
  return (
    <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2">
      <div className="sm:col-span-1">
        <Label className="text-xs">{"세부명"}</Label>
        <Input value={v.name} onChange={(e) => setV((p) => ({ ...p, name: e.target.value }))} />
      </div>
      <div>
        <Label className="text-xs">{"유통기한"}</Label>
        <Input
          type="date"
          value={v.expiry}
          min={toISO(new Date())}
          onChange={(e) => setV((p) => ({ ...p, expiry: e.target.value }))}
        />
      </div>
      <div>
        <Label className="text-xs">{"메모(선택)"}</Label>
        <Input value={v.memo} onChange={(e) => setV((p) => ({ ...p, memo: e.target.value }))} />
      </div>
      <div className="sm:col-span-3 flex justify-end">
        <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => onSave(v)}>
          {"저장"}
        </Button>
      </div>
    </div>
  )
}
function splitDetail(fullName: string, bundleName: string): [string, boolean] {
  const prefix = `${bundleName} - `
  if (fullName.startsWith(prefix)) {
    return [fullName.slice(prefix.length), true]
  }
  return [fullName, false]
}
function getBundleName(name: string) {
  const idx = name.indexOf(" - ")
  return idx >= 0 ? name.slice(0, idx) : name
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

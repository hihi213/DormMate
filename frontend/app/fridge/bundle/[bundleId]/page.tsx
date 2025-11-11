"use client"

import type { ReactNode } from "react"

import { useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useFridge } from "@/features/fridge/hooks/fridge-context"
import { formatStickerLabel } from "@/features/fridge/utils/labels"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ArrowLeft, CalendarDays, Loader2, Pencil, Trash2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { getCurrentUserId } from "@/lib/auth"
import { formatShortDate } from "@/lib/date-utils"

export default function BundleDetailPage() {
  const router = useRouter()
  const search = useSearchParams()
  const { items, updateItem, deleteItem } = useFridge()
  const [bundleId, setBundleId] = useState<string>("")
  const [edit, setEdit] = useState<boolean>(false)
  const { toast } = useToast()
  const uid = getCurrentUserId()
  const [savingId, setSavingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    const id = decodeURIComponent(window.location.pathname.split("/").pop() || "")
    setBundleId(id)
    setEdit(search.get("edit") === "1")
  }, [search])

  const group = useMemo(() => items.filter((x) => x.bundleId === bundleId), [items, bundleId])
  const first = group[0]
  const bundleName = first?.bundleName ?? "묶음"
  const groupCode = first ? formatStickerLabel(first.slotIndex, first.labelNumber) : ""
  const canManage = first && first.ownerId ? uid === first.ownerId : false

  // Sorted detail items by urgency
  const sorted = useMemo(() => group.slice().sort((a, b) => daysLeft(a.expiryDate) - daysLeft(b.expiryDate)), [group])

  if (group.length === 0) {
    return (
      <main className="min-h-[100svh] bg-white">
        <Header title="묶음 상세" onBack={() => router.back()} />
        <div className="mx-auto max-w-screen-sm px-4 py-8">
          <p className="text-sm text-muted-foreground">{"해당 묶음을 찾을 수 없습니다."}</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-[100svh] bg-white">
      <Header
        title={bundleName}
        onBack={() => router.back()}
        right={
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
        }
      />

      <div className="mx-auto max-w-screen-sm px-4 pb-20 pt-4 space-y-4">
        {/* Representative info */}
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

        {/* Detail list */}
        <Card>
          <CardContent className="py-3 space-y-2">
            {sorted.map((it) => {
              const d = daysLeft(it.expiryDate)
              const dText = ddayLabel(d)
              const statusColor = d < 0 ? "text-rose-600" : d <= 1 ? "text-amber-600" : "text-emerald-700"
              const [detailName, suffix] = splitDetail(it.name, bundleName)
              return (
                <div key={it.unitId} className="rounded-md border p-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{detailName}</div>
                      <div className="mt-0.5 text-xs text-muted-foreground">{formatStickerLabel(it.slotIndex, it.labelNumber)}</div>
                      <div className={`mt-0.5 inline-flex items-center gap-1 text-sm ${statusColor}`}>
                        <CalendarDays className="size-4" />
                        <span>{`${formatShortDate(it.expiryDate)} • ${dText}`}</span>
                      </div>
                      {canManage && edit && (
                        <EditRow
                          value={{ name: detailName, expiryDate: it.expiryDate, memo: it.memo || "" }}
                          saving={savingId === it.unitId}
                          onSave={async (v) => {
                            if (savingId) return
                            setSavingId(it.unitId)
                            const result = await updateItem(it.unitId, {
                              name: suffix ? `${bundleName} - ${v.name}` : `${bundleName} - ${v.name}`,
                              expiryDate: v.expiryDate,
                              memo: v.memo || undefined,
                            })
                            setSavingId(null)
                            if (result.success) {
                              toast({
                                title: "수정 완료",
                                description: `${v.name.trim() || detailName} 항목이 업데이트되었습니다.`,
                              })
                            } else {
                              toast({
                                title: "수정 실패",
                                description: result.error ?? "물품 수정 중 오류가 발생했습니다.",
                                variant: "destructive",
                              })
                            }
                          }}
                        />
                      )}
                      {it.memo && !edit && <div className="text-xs text-muted-foreground">{`메모: ${it.memo}`}</div>}
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
                          onClick={async () => {
                            if (deletingId || !confirm("해당 세부 물품을 삭제할까요? (되돌릴 수 없음)")) return
                            setDeletingId(it.unitId)
                            const result = await deleteItem(it.unitId)
                            setDeletingId(null)
                            if (result.success) {
                              toast({
                                title: "삭제됨",
                                description: `${detailName} 항목이 삭제되었습니다.`,
                              })
                            } else {
                              toast({
                                title: "삭제 실패",
                                description: result.error ?? "세부 물품 삭제 중 오류가 발생했습니다.",
                                variant: "destructive",
                              })
                            }
                          }}
                          disabled={deletingId === it.unitId}
                          aria-label="삭제"
                        >
                          {deletingId === it.unitId ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <Trash2 className="size-4" />
                          )}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>
      </div>
    </main>
  )
}

/* UI helpers */
function Header({ title, onBack, right }: { title: string; onBack: () => void; right?: ReactNode }) {
  return (
    <header className="sticky top-0 z-40 border-b bg-white/80 backdrop-blur">
      <div className="mx-auto max-w-screen-sm px-2 py-3 flex items-center">
        <Button variant="ghost" size="icon" aria-label="뒤로" onClick={onBack}>
          <ArrowLeft className="size-5" />
        </Button>
        <div className="flex-1 text-center">
          <h1 className="text-base font-semibold leading-none truncate max-w-[70vw]">{title}</h1>
        </div>
        <div className="inline-flex items-center gap-1">{right}</div>
      </div>
    </header>
  )
}
function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm">{value}</div>
    </div>
  )
}
function EditRow({
  value,
  onSave = async () => {},
  saving = false,
}: {
  value: { name: string; expiryDate: string; memo: string }
  onSave?: (v: { name: string; expiryDate: string; memo: string }) => void | Promise<unknown>
  saving?: boolean
}) {
  const [v, setV] = useState(value)
  useEffect(() => setV(value), [value])
  const [localSaving, setLocalSaving] = useState(false)

  const handleSave = async () => {
    if (saving || localSaving) return
    try {
      setLocalSaving(true)
      await onSave(v)
    } finally {
      setLocalSaving(false)
    }
  }

  const busy = saving || localSaving
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
          value={v.expiryDate}
          min={toISO(new Date())}
          onChange={(e) => setV((p) => ({ ...p, expiryDate: e.target.value }))}
        />
      </div>
      <div>
        <Label className="text-xs">{"메모(선택)"}</Label>
        <Input value={v.memo} onChange={(e) => setV((p) => ({ ...p, memo: e.target.value }))} />
      </div>
      <div className="sm:col-span-3 flex justify-end">
        <Button
          className="bg-emerald-600 hover:bg-emerald-700"
          onClick={() => void handleSave()}
          disabled={busy}
        >
          {busy && <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />}
          {"저장"}
        </Button>
      </div>
    </div>
  )
}

/* Utils */
function splitDetail(fullName: string, bundleName: string): [string, boolean] {
  const prefix = `${bundleName} - `
  if (fullName.startsWith(prefix)) {
    return [fullName.slice(prefix.length), true]
  }
  return [fullName, false]
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

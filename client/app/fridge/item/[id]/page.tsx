"use client"

import type React from "react"

import { useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { FridgeProvider, useFridge } from "@/components/fridge/fridge-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ArrowLeft, CalendarDays, Pencil, Trash2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { getCurrentUserId } from "@/lib/auth"

export default function ItemDetailPage() {
  return (
    <FridgeProvider>
      <DetailInner />
    </FridgeProvider>
  )
}

function DetailInner() {
  const router = useRouter()
  const search = useSearchParams()
  const { items, updateItem, deleteItem } = useFridge()
  const [itemId, setItemId] = useState<string>("")
  const [edit, setEdit] = useState<boolean>(false)
  const { toast } = useToast()

  useEffect(() => {
    const id = decodeURIComponent(window.location.pathname.split("/").pop() || "")
    setItemId(id)
    setEdit(search.get("edit") === "1")
  }, [search])

  const it = useMemo(() => items.find((x) => x.id === itemId) || null, [items, itemId])
  const uid = getCurrentUserId()
  const canEdit = !!(it && (it.ownerId ? uid === it.ownerId : it.owner === "me"))

  const [form, setForm] = useState({ name: "", expiry: "", memo: "" })
  useEffect(() => {
    if (it) setForm({ name: it.name, expiry: it.expiry, memo: it.memo || "" })
  }, [it])

  if (!it) {
    return (
      <main className="min-h-[100svh] bg-white">
        <Header title="상세 정보" onBack={() => router.back()} />
        <div className="mx-auto max-w-screen-sm px-4 py-8">
          <p className="text-sm text-muted-foreground">{"해당 물품을 찾을 수 없습니다."}</p>
        </div>
      </main>
    )
  }

  const d = daysLeft(it.expiry)
  const dText = ddayLabel(d)
  const isExpired = d < 0
  const statusColor = isExpired ? "text-rose-600" : d <= 1 ? "text-amber-600" : "text-emerald-700"

  return (
    <main className="min-h-[100svh] bg-white">
      <Header
        title={it.name}
        onBack={() => router.back()}
        right={
          <div className="inline-flex items-center gap-2">
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
                if (!canEdit) return
                if (confirm("해당 물품을 삭제하시겠어요? (되돌릴 수 없음)")) {
                  deleteItem(it.id)
                  toast({ title: "삭제됨", description: `${it.id} 항목이 삭제되었습니다.` })
                  router.push("/fridge")
                }
              }}
              disabled={!canEdit}
              title={canEdit ? "삭제" : "소유자만 삭제"}
            >
              <Trash2 className="size-5 text-rose-600" />
            </Button>
          </div>
        }
      />

      <div className="mx-auto max-w-screen-sm px-4 pb-20 pt-4 space-y-4">
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
                <Input id="name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
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
                <Input id="memo" value={form.memo} onChange={(e) => setForm((f) => ({ ...f, memo: e.target.value }))} />
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
      </div>
    </main>
  )
}

/* UI helpers */
function Header({ title, onBack, right }: { title: string; onBack: () => void; right?: React.ReactNode }) {
  // Local slide-in animation
  return (
    <header className="sticky top-0 z-40 border-b bg-white/80 backdrop-blur">
      <div className="mx-auto max-w-screen-sm px-2 py-3 flex items-center">
        <Button variant="ghost" size="icon" aria-label="뒤로" onClick={onBack}>
          <ArrowLeft className="size-5" />
        </Button>
        <div className="flex-1 text-center">
          <div className="inline-flex items-center gap-2">
            <h1 className="text-base font-semibold leading-none truncate max-w-[70vw]">{title}</h1>
          </div>
        </div>
        <div className="inline-flex items-center gap-1">{right}</div>
      </div>
    </header>
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

/* Utils */
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

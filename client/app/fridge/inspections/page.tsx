"use client"

import { useEffect, useState } from "react"
import { ArrowLeft, Plus, CalendarDays, MoreVertical, Edit3, Trash2, CheckCircle, Play, History, Save, X } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { getCurrentUserId } from "@/lib/auth"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import BottomNav from "@/components/bottom-nav"
import AuthGuard from "@/components/auth-guard"

// 일정 타입
type Schedule = {
  id: string
  dateISO: string
  title?: string
  notes?: string
  completed?: boolean
  completedAt?: string
  completedBy?: string
}

const SCHED_KEY = "fridge-inspections-schedule-v1"

export default function InspectionsPage() {
  return (
    <AuthGuard>
      <InspectionsInner />
      <BottomNav />
    </AuthGuard>
  )
}

function InspectionsInner() {
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [isFloorLead, setIsFloorLead] = useState(false) // 1번 계정 = 층별장 특수 역할
  const uid = getCurrentUserId()

  // 에디터 상태
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<{ title: string; date: string; time: string; notes: string }>({
    title: "정기 점검",
    date: new Date().toISOString().slice(0, 10),
    time: new Date().toISOString().slice(11, 16),
    notes: "",
  })

  useEffect(() => {
    try {
      const savedS = JSON.parse(localStorage.getItem(SCHED_KEY) || "null") as Schedule[] | null
      if (Array.isArray(savedS) && savedS.length > 0) {
        setSchedules(savedS)
      } else {
        const demoS: Schedule[] = makeDemoSchedules()
        setSchedules(demoS)
        localStorage.setItem(SCHED_KEY, JSON.stringify(demoS))
      }
    } catch {
      const demoS: Schedule[] = makeDemoSchedules()
      setSchedules(demoS)
    }

    // 권한: 1번 계정은 층별장
    setIsFloorLead(uid === "1")
  }, [uid])

  const save = (list: Schedule[]) => {
    setSchedules(list)
    try {
      localStorage.setItem(SCHED_KEY, JSON.stringify(list))
    } catch {}
  }

  const upcomingSorted = schedules
    .filter((s) => !s.completed)
    .slice()
    .sort((a, b) => a.dateISO.localeCompare(b.dateISO))

  const pastSorted = schedules
    .filter((s) => !!s.completed)
    .slice()
    .sort((a, b) => (b.completedAt || b.dateISO).localeCompare(a.completedAt || a.dateISO))

  // 일정 추가/수정/삭제/완료
  const openEditorForCreate = () => {
    if (!isFloorLead) return
    setEditingId(null)
    const now = new Date()
    setForm({
      title: "정기 점검",
      date: now.toISOString().slice(0, 10),
      time: now.toISOString().slice(11, 16),
      notes: "",
    })
    setEditorOpen(true)
  }

  const openEditorForEdit = (id: string) => {
    if (!isFloorLead) return
    const s = schedules.find((x) => x.id === id)
    if (!s) return
    const d = new Date(s.dateISO)
    setEditingId(id)
    setForm({
      title: s.title || "검사",
      date: d.toISOString().slice(0, 10),
      time: d.toISOString().slice(11, 16),
      notes: s.notes || "",
    })
    setEditorOpen(true)
  }

  const handleSaveEditor = () => {
    const iso = new Date(`${form.date}T${form.time}:00`).toISOString()
    if (editingId) {
      const next = schedules.map((x) => (x.id === editingId ? { ...x, title: form.title, dateISO: iso, notes: form.notes } : x))
      save(next)
    } else {
      const next: Schedule = { id: cryptoRandomId(), title: form.title, dateISO: iso, notes: form.notes, completed: false }
      save([next, ...schedules])
    }
    setEditorOpen(false)
  }

  const handleDelete = (id: string) => {
    if (!isFloorLead) return
    if (!confirm("해당 일정을 삭제할까요?")) return
    save(schedules.filter((x) => x.id !== id))
  }

  const handleComplete = (id: string) => {
    if (!isFloorLead) return
    const now = new Date().toISOString()
    const next = schedules.map((x) => (x.id === id ? { ...x, completed: true, completedAt: now, completedBy: uid || undefined } : x))
    save(next)
  }

  const handleStartInspection = (id: string) => {
    if (typeof window !== "undefined") {
      window.location.href = `/fridge/inspect?id=${encodeURIComponent(id)}`
    }
  }

  return (
    <main className="min-h-[100svh] bg-white">
      <header className="sticky top-0 z-40 border-b bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="mx-auto max-w-screen-sm px-2 py-3 flex items-center">
          <Button
            variant="ghost"
            size="icon"
            aria-label="냉장고로 이동"
            onClick={() => {
              if (typeof window !== "undefined") window.location.href = "/fridge"
            }}
          >
            <ArrowLeft className="size-5" />
          </Button>
          <div className="flex-1 text-center">
            <div className="inline-flex items-center gap-2">
              <CalendarDays className="size-4 text-teal-700" />
              <h1 className="text-base font-semibold leading-none">{"검사 이력 및 관리"}</h1>
            </div>
          </div>
          <div className="inline-flex items-center gap-1">
            {isFloorLead && (
              <Button variant="ghost" size="icon" aria-label="검사 일정 추가" onClick={openEditorForCreate}>
                <Plus className="size-5" />
              </Button>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-screen-sm px-4 pb-28 pt-4 space-y-6">
        {/* 예정된 검사 */}
        <section>
          <Card className="border-emerald-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <CalendarDays className="size-4 text-emerald-700" />
                {"예정된 검사"}
                <Badge variant="secondary" className="ml-auto">{`${upcomingSorted.length}건`}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {upcomingSorted.length === 0 ? (
                <p className="text-sm text-muted-foreground">{"예정된 검사 일정이 없습니다."}</p>
              ) : (
                <ul className="space-y-2">
                  {upcomingSorted.map((s) => (
                    <li key={s.id} className="flex items-center gap-2 rounded-md border p-2">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium">{s.title || "냉장고 점검"}</div>
                        <div className="text-xs text-muted-foreground">{formatDate(s.dateISO)}</div>
                        {s.notes && <div className="text-xs text-muted-foreground mt-1">{s.notes}</div>}
                      </div>

                      {isFloorLead && (
                        <div className="inline-flex items-center gap-1">
                          <Button variant="outline" size="sm" onClick={() => handleStartInspection(s.id)} aria-label="검사 시작">
                            <Play className="size-4 mr-1" />
                            {"검사 시작"}
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreVertical className="size-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEditorForEdit(s.id)}>
                                <Edit3 className="size-4 mr-2" />
                                수정하기
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleComplete(s.id)}>
                                <CheckCircle className="size-4 mr-2" />
                                완료로 표시
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleDelete(s.id)} className="text-red-600">
                                <Trash2 className="size-4 mr-2" />
                                삭제하기
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </section>

        {/* 과거 검사 이력 */}
        <section>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <History className="size-4 text-gray-700" />
                {"과거 검사 이력"}
                <Badge variant="secondary" className="ml-auto">{`${pastSorted.length}건`}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {pastSorted.length === 0 ? (
                <p className="text-sm text-muted-foreground">{"과거 검사 이력이 없습니다."}</p>
              ) : (
                <ul className="space-y-2">
                  {pastSorted.map((s) => (
                    <li key={s.id} className="rounded-md border p-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-sm font-medium">{s.title || "냉장고 점검"}</div>
                          <div className="text-xs text-muted-foreground">
                            {`${formatDate(s.dateISO)} • 완료: ${formatDate(s.completedAt || s.dateISO)}`}
                          </div>
                        </div>
                        {s.completedBy && (
                          <span className="text-[11px] text-muted-foreground">{`처리자 #${s.completedBy}`}</span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </section>
      </div>

      {/* 일정 편집 다이얼로그 */}
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? "일정 수정" : "일정 추가"}</DialogTitle>
            <DialogDescription className="sr-only">검사 일정을 추가/수정합니다.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid gap-1.5">
              <Label htmlFor="title">제목</Label>
              <Input id="title" value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="grid gap-1.5">
                <Label htmlFor="date">날짜</Label>
                <Input id="date" type="date" value={form.date} onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="time">시간</Label>
                <Input id="time" type="time" value={form.time} onChange={(e) => setForm((p) => ({ ...p, time: e.target.value }))} />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="notes">메모(선택)</Label>
              <Input id="notes" value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setEditorOpen(false)}>
                <X className="size-4 mr-1" /> 취소
              </Button>
              <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleSaveEditor}>
                <Save className="size-4 mr-1" /> 저장
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  )
}

function makeDemoSchedules(): Schedule[] {
  const addDays = (base: Date, days: number, hour = 10) => {
    const d = new Date(base)
    d.setDate(d.getDate() + days)
    d.setHours(hour, 0, 0, 0)
    return d.toISOString()
  }
  const now = new Date()

  // 과거 1건(완료), 미래 2건(예정)
  return [
    { id: "p1", dateISO: addDays(now, -3, 9), title: "주간 점검", notes: "1층 냉장고", completed: true, completedAt: addDays(now, -3, 11), completedBy: "1" },
    { id: "u1", dateISO: addDays(now, 1, 9), title: "주간 점검", notes: "1층 먼저" },
    { id: "u2", dateISO: addDays(now, 7, 10), title: "정기 점검" },
  ]
}

function formatDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "long", hour: "2-digit", minute: "2-digit" })
}

function cryptoRandomId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return (crypto as any).randomUUID() as string
  return Math.random().toString(36).slice(2)
}

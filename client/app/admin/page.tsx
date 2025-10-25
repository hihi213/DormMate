"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { ClipboardCheck, ListChecks, ShieldCheck } from "lucide-react"

import BottomNav from "@/components/bottom-nav"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import AuthGuard from "@/features/auth/components/auth-guard"
import { getCurrentUser, subscribeAuth, type AuthUser } from "@/lib/auth"

const SCHEDULE_STORAGE_KEY = "fridge-inspections-schedule-v1"
const HISTORY_STORAGE_KEY = "fridge-inspections-history-v1"

type Schedule = {
  id: string
  dateISO: string
  title?: string
  notes?: string
  completed?: boolean
  completedAt?: string
  completedBy?: string
  summary?: { passed: number; warned: number; discarded: number }
}

type HistoryRecord = {
  id: string
  dateISO: string
  passed?: number
  warned?: number
  discarded?: number
  notes?: string
}

const ROLE_LABEL = {
  RESIDENT: "거주자",
  FLOOR_MANAGER: "층별장",
  ADMIN: "관리자",
} as const

export default function AdminPage() {
  return (
    <AuthGuard>
      <AdminInner />
      <BottomNav />
    </AuthGuard>
  )
}

function AdminInner() {
  const router = useRouter()
  const [authUser, setAuthUser] = useState<AuthUser | null>(getCurrentUser())
  const [schedule, setSchedule] = useState<Schedule[]>([])
  const [history, setHistory] = useState<HistoryRecord[]>([])
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const unsubscribe = subscribeAuth(setAuthUser)
    return () => unsubscribe()
  }, [])

  useEffect(() => {
    if (!mounted) return
    if (typeof window === "undefined") return
    try {
      const rawSchedule = JSON.parse(localStorage.getItem(SCHEDULE_STORAGE_KEY) || "null") as Schedule[] | null
      if (Array.isArray(rawSchedule)) {
        setSchedule(rawSchedule)
      }
    } catch {
      setSchedule([])
    }

    try {
      const rawHistory = JSON.parse(localStorage.getItem(HISTORY_STORAGE_KEY) || "null") as HistoryRecord[] | null
      if (Array.isArray(rawHistory)) {
        setHistory(rawHistory)
      }
    } catch {
      setHistory([])
    }
  }, [mounted])

  const isAdmin = authUser?.roles.includes("ADMIN")

  useEffect(() => {
    if (mounted && authUser && !authUser.roles.includes("ADMIN")) {
      router.replace("/")
    }
  }, [authUser, mounted, router])

  const upcomingSchedules = useMemo(
    () =>
      schedule
        .filter((entry) => !entry.completed)
        .slice()
        .sort((a, b) => a.dateISO.localeCompare(b.dateISO)),
    [schedule],
  )

  const entryTime = (entry: Schedule) => entry.completedAt ?? entry.dateISO

  const completedSchedules = useMemo(
    () =>
      schedule
        .filter((entry) => entry.completed)
        .slice()
        .sort((a, b) => entryTime(b).localeCompare(entryTime(a))),
    [schedule],
  )
  if (!isAdmin) {
    return (
      <main className="min-h-[100svh] bg-white">
        <div className="mx-auto max-w-screen-sm px-4 py-16 space-y-6 text-center">
          <ShieldCheck className="mx-auto h-12 w-12 text-emerald-600" />
          <h1 className="text-xl font-semibold text-gray-900">관리자 권한이 필요합니다.</h1>
          <p className="text-sm text-muted-foreground">
            이 화면은 DormMate 관리자만 접근할 수 있습니다. 권한이 없다면 메인 페이지로 이동해 주세요.
          </p>
          <Button onClick={() => router.replace("/")}>메인으로 이동</Button>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-[100svh] bg-white pb-28">
      <header className="sticky top-0 z-40 border-b bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="mx-auto flex max-w-screen-sm items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-700" />
            <div>
              <p className="text-sm font-medium text-gray-700">DormMate Admin</p>
              <p className="text-xs text-muted-foreground">{authUser?.name}</p>
            </div>
          </div>
          <Badge variant="outline">{ROLE_LABEL.ADMIN}</Badge>
        </div>
      </header>

      <div className="mx-auto flex max-w-screen-sm flex-col gap-6 px-4 py-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <ClipboardCheck className="h-4 w-4 text-emerald-700" />
              예정된 검사
              <Badge variant="secondary" className="ml-auto">
                {upcomingSchedules.length}건
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {upcomingSchedules.length === 0 ? (
              <p className="text-sm text-muted-foreground">예정된 검사가 없습니다.</p>
            ) : (
              <ul className="space-y-2">
                {upcomingSchedules.map((entry) => (
                  <li key={entry.id} className="rounded-md border px-3 py-2">
                    <div className="text-sm font-medium text-gray-900">{entry.title ?? "검사"}</div>
                    <div className="text-xs text-muted-foreground">{new Date(entry.dateISO).toLocaleString("ko-KR")}</div>
                    {entry.notes && <div className="mt-1 text-xs text-muted-foreground">{entry.notes}</div>}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <ListChecks className="h-4 w-4 text-emerald-700" />
              최근 검사 결과
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {history.length === 0 ? (
              <p className="text-sm text-muted-foreground">최근 제출된 검사 결과가 없습니다.</p>
            ) : (
              <ul className="space-y-2">
                {history.slice(0, 3).map((entry) => (
                  <li key={entry.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {new Date(entry.dateISO).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </div>
                      {entry.notes && <div className="text-xs text-muted-foreground">{entry.notes}</div>}
                    </div>
                    <div className="flex gap-1 text-xs">
                      <Badge variant="outline" className="border-emerald-200 text-emerald-700">
                        통과 {entry.passed ?? 0}
                      </Badge>
                      <Badge variant="outline" className="border-amber-200 text-amber-700">
                        경고 {entry.warned ?? 0}
                      </Badge>
                      <Badge variant="outline" className="border-rose-200 text-rose-700">
                        폐기 {entry.discarded ?? 0}
                      </Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              {"층별장 관리"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              층별장 임명 기능은 백엔드 연동이 준비되는 대로 제공될 예정입니다.
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}

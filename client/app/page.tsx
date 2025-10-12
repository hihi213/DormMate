"use client"

import type React from "react"

import { useEffect, useMemo, useState } from "react"
import { BookOpen, DoorOpen, Megaphone, CalendarDays, User } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import NotificationPermission from "@/components/notification-permission"
import BottomNav from "@/components/bottom-nav"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { USERS, getCurrentUser, setCurrentUser, logout as doLogout, type AuthUser } from "@/lib/auth"
import { resetAndSeedAll } from "@/lib/demo-seed"

const SCHED_KEY = "fridge-inspections-schedule-v1"

type Schedule = {
  id: string
  dateISO: string
  title?: string
  notes?: string
}

type LaundryMsg = { text: string; name: string; room: string }

export default function Page() {
  // Keep SW registration
  useEffect(() => {
    if (typeof window === "undefined") return
    if ("serviceWorker" in navigator) {
      ;(async () => {
        const candidates: Array<{ url: string; opts?: RegistrationOptions }> = [
          { url: "/sw.js", opts: { scope: "/" } }, // prefer root scope
          { url: new URL("sw.js", window.location.href).toString() }, // fallback (sub-paths)
        ]
        for (const c of candidates) {
          try {
            const reg = await navigator.serviceWorker.register(c.url, c.opts as any)
            // Optional: log which URL succeeded
            // console.log("[SW] registered:", reg.scope)
            break
          } catch {
            // try next
          }
        }
      })()
    }
  }, [])

  return <HomeInner />
}

function HomeInner() {
  // 마운트 상태 관리
  const [mounted, setMounted] = useState(false)
  
  // Auth state
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  
  useEffect(() => {
    setMounted(true)
    const currentUser = getCurrentUser()
    setUser(currentUser)
    setIsLoggedIn(!!currentUser)
  }, [])

  // Login dialog
  const [loginOpen, setLoginOpen] = useState(false)
  const [infoOpen, setInfoOpen] = useState(false)
  const [loginId, setLoginId] = useState("")
  const [loginPw, setLoginPw] = useState("")
  const [loginErr, setLoginErr] = useState("")

  function handleLoginSubmit(e?: React.FormEvent) {
    e?.preventDefault()
    const found = USERS[loginId.trim()]
    if (!found || found.password !== loginPw.trim()) {
      setLoginErr("아이디 또는 비밀번호가 올바르지 않습니다.")
      return
    }
    setCurrentUser(found.id)
    const currentUser = getCurrentUser()
    setUser(currentUser)
    setIsLoggedIn(!!currentUser)
    setLoginOpen(false)
    setLoginId("")
    setLoginPw("")
    setLoginErr("")
  }
  
  function logout() {
    doLogout()
    setUser(null)
    setIsLoggedIn(false)
  }

  // Announcements / Next inspection
  const [nextInspection, setNextInspection] = useState<{ dday: string; label: string } | null>(null)
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(SCHED_KEY) || "null") as Schedule[] | null
      if (Array.isArray(saved) && saved.length) {
        const now = new Date()
        const upcoming = saved
          .map((s) => ({ ...s, d: new Date(s.dateISO) }))
          .filter((s) => s.d.getTime() >= now.getTime())
          .sort((a, b) => a.d.getTime() - b.d.getTime())[0]
        if (upcoming) {
          const d = calcDday(upcoming.d)
          setNextInspection({
            dday: d.dday,
            label: `${fmtMonthDay(upcoming.d)} (${d.dday})`,
          })
        } else {
          setNextInspection({ dday: "-", label: "예정 없음" })
        }
      } else {
        setNextInspection({ dday: "-", label: "예정 없음" })
      }
    } catch {
      setNextInspection({ dday: "-", label: "예정 없음" })
    }
  }, [])

  // Laundry session
  const [deviceLabel, setDeviceLabel] = useState<string>("세탁기 #2")
  const [totalSec, setTotalSec] = useState<number>(45 * 60)
  const [endTs, setEndTs] = useState<number>(0)
  const [leftSec, setLeftSec] = useState<number>(0)

  useEffect(() => {
    // 클라이언트에서만 시간 관련 상태를 설정
    if (typeof window !== "undefined") {
      const saved = Number(localStorage.getItem("my-laundry-end") || "0")
      const end = saved || Date.now() + 15 * 60_000
      if (!saved) localStorage.setItem("my-laundry-end", String(end))
      setEndTs(end)
      setLeftSec(Math.max(0, Math.floor((end - Date.now()) / 1000)))
    }
  }, [])

  useEffect(() => {
    try {
      const dev = localStorage.getItem("my-laundry-device")
      if (dev) setDeviceLabel(dev)
      const t = Number(localStorage.getItem("my-laundry-total-sec") || "0")
      if (t > 0) setTotalSec(t)
    } catch {}
  }, [])

  useEffect(() => {
    if (!mounted) return
    const id = setInterval(() => {
      setLeftSec(Math.max(0, Math.floor((endTs - Date.now()) / 1000)))
    }, 1000)
    return () => clearInterval(id)
  }, [endTs, mounted])
  const endLabel = useMemo(
    () => new Date(endTs).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }),
    [endTs],
  )
  const progress = useMemo(() => {
    if (totalSec <= 0) return 0
    const elapsed = Math.min(totalSec, Math.max(0, totalSec - leftSec))
    return elapsed / totalSec
  }, [leftSec, totalSec])
  const ringLabel = useMemo(() => {
    if (leftSec >= 3600) {
      const h = Math.floor(leftSec / 3600)
      const m = Math.floor((leftSec % 3600) / 60)
      return `${h}:${pad2(m)}`
    }
    const m = Math.max(0, Math.ceil(leftSec / 60))
    return `${m}분`
  }, [leftSec])

  // Messages
  const [messages, setMessages] = useState<LaundryMsg[]>([
    { text: "기다리고 있어요", name: "이민수", room: "302호" },
    { text: "끝나면 알려주세요", name: "박지현", room: "210호" },
  ])
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("laundry-messages") || "null") as LaundryMsg[] | null
      if (Array.isArray(saved) && saved.length) setMessages(saved.slice(0, 2))
    } catch {}
  }, [])

  return (
    <main className="min-h-[100svh] bg-white text-gray-900">
      <header className="sticky top-0 z-40 border-b bg-white/80 backdrop-blur">
        <div className="mx-auto max-w-screen-sm px-4 py-3 flex items-center gap-3">
          <div className="flex-1">
            <h1 className="text-lg font-semibold leading-none">{"OO기숙사"}</h1>
            {mounted && isLoggedIn ? (
              <p className="text-xs text-muted-foreground leading-tight">{`${user?.name} - ${user?.room}`}</p>
            ) : (
              <p className="text-xs text-muted-foreground leading-tight">{"로그인이 필요합니다"}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <NotificationPermission />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="inline-flex items-center justify-center rounded-full border w-9 h-9 bg-transparent"
                  aria-label="마이페이지"
                >
                  <User className="w-4 h-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {mounted && isLoggedIn ? (
                  <>
                    <DropdownMenuLabel className="truncate">{`${user?.name} · ${user?.room}`}</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setInfoOpen(true)}>{"내정보"}</DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        resetAndSeedAll(user?.id)
                        location.reload()
                      }}
                    >
                      {"데모 데이터 초기화"}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={logout}>{"로그아웃"}</DropdownMenuItem>
                  </>
                ) : (
                  <>
                    <DropdownMenuLabel>{"로그인이 필요합니다"}</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setLoginOpen(true)}>{"로그인"}</DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        // Seed with default user 1 and log in
                        setCurrentUser("1")
                        resetAndSeedAll("1")
                        location.reload()
                      }}
                    >
                      {"데모 시작(1번 계정)"}
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-screen-sm px-4 pb-28 pt-3 space-y-6">
        {!mounted || !isLoggedIn ? (
          // 로그인 전 또는 마운트 전: 로그인 안내 메시지만 표시
          <div className="space-y-6">
            <Card className="border-slate-200 bg-slate-50">
              <CardContent className="py-12 text-center">
                <div className="w-16 h-16 rounded-full bg-gray-100 mx-auto mb-4 flex items-center justify-center">
                  <User className="w-8 h-8 text-gray-400" />
                </div>
                <h2 className="text-lg font-semibold text-gray-900 mb-2">로그인이 필요합니다</h2>
                <p className="text-sm text-gray-600 mb-4">
                  기숙사 서비스를 이용하려면 로그인해주세요
                </p>
                <Button 
                  onClick={() => setLoginOpen(true)}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  로그인하기
                </Button>
              </CardContent>
            </Card>
          </div>
        ) : (
          // 로그인 후: 기존 데이터 표시
          <>
            {/* Merged block */}
            <div className="space-y-3">
              <Card className="border-slate-200 bg-slate-50">
                <CardContent className="py-3">
                  <div className="flex items-start gap-2">
                    <div
                      className="w-7 h-7 rounded-md bg-emerald-600 text-white grid place-items-center"
                      aria-hidden="true"
                    >
                      <Megaphone className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold truncate">{"주요 공지"}</p>
                      <p className="text-[11px] text-slate-700 truncate">{"하계 휴관 안내 (8/1~8/20) • 정기 소독 안내"}</p>
                    </div>
                  </div>

                  <div className="mt-2 pt-2 border-t">
                    <div className="flex items-start gap-2">
                      <div
                        className="w-7 h-7 rounded-md bg-slate-700 text-white grid place-items-center"
                        aria-hidden="true"
                      >
                        <CalendarDays className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold truncate">{"다음 냉장고 정기점검"}</p>
                        <p className="text-[11px] text-slate-700 truncate">
                          {nextInspection ? `${nextInspection.label}` : "불러오는 중..."}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Personalized status */}
            <section aria-labelledby="personalized" className="space-y-3">
              <h2 id="personalized" className="sr-only">
                {"개인화된 이용 현황"}
              </h2>

              {/* Laundry */}
              <Card>
                <CardContent className="py-3">
                  <div className="flex items-start gap-4">
                    <ProgressRing 
                      size={64} 
                      strokeWidth={6} 
                      progress={mounted ? progress : 0} 
                      label={mounted ? ringLabel : "0분"} 
                    />
                    <div className="flex-1 min-w-0">
                      <div className="inline-flex items-center rounded-md border bg-white px-2 py-1 text-xs font-medium text-gray-700">
                        {deviceLabel}
                      </div>
                      <div className="mt-1 text-[11px] text-muted-foreground">
                        {mounted ? `(${endLabel})` : "(--:--)"}
                      </div>
                    </div>
                  </div>

                  {messages.length > 0 && (
                    <ul className="mt-3 space-y-1.5">
                      {messages.slice(0, 2).map((m, i) => (
                        <li
                          key={`${m.text}-${i}`}
                          className="rounded-md border px-2.5 py-2 bg-gray-50 text-sm leading-tight"
                        >
                          <div className="truncate">{m.text}</div>
                          <div className="text-[11px] text-gray-600">
                            <span className="mr-1">{m.name}</span>
                            <span className="text-gray-400">{m.room}</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>

              {/* Library */}
              <Card>
                <CardContent className="py-3 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-md bg-amber-600 text-white grid place-items-center" aria-hidden="true">
                    <BookOpen className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{"내 대출 도서"}</p>
                    <p className="text-xs text-muted-foreground truncate">{`'${"AI 시대의 비판적 사고"}' 반납 ${"D-2"}`}</p>
                  </div>
                  <a
                    href="/library"
                    className="rounded-md border px-3 py-1.5 text-sm hover:bg-gray-50 shrink-0"
                    aria-label="도서로 이동"
                  >
                    {"이동"}
                  </a>
                </CardContent>
              </Card>

              {/* Study */}
              <Card>
                <CardContent className="py-3 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-md bg-slate-700 text-white grid place-items-center" aria-hidden="true">
                    <DoorOpen className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{"내 스터디룸 예약"}</p>
                    <p className="text-xs text-muted-foreground truncate">{`오늘 ${"19:00"}, 스터디룸 A 예약`}</p>
                  </div>
                  <a
                    href="/study"
                    className="rounded-md border px-3 py-1.5 text-sm hover:bg-gray-50 shrink-0"
                    aria-label="스터디룸으로 이동"
                  >
                    {"이동"}
                  </a>
                </CardContent>
              </Card>
            </section>
          </>
        )}
      </div>

      <BottomNav />

      {/* Login Dialog */}
      <Dialog open={loginOpen} onOpenChange={setLoginOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{"로그인"}</DialogTitle>
          </DialogHeader>
          <form className="space-y-3" onSubmit={handleLoginSubmit}>
            <div className="grid gap-2">
              <Label htmlFor="login-id">{"아이디"}</Label>
              <Input
                id="login-id"
                value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
                placeholder="예: 1, 2, 3"
                inputMode="numeric"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="login-pw">{"비밀번호"}</Label>
              <Input
                id="login-pw"
                type="password"
                value={loginPw}
                onChange={(e) => setLoginPw(e.target.value)}
                placeholder="예: 1, 2, 3"
              />
            </div>

            {loginErr && <p className="text-xs text-rose-600">{loginErr}</p>}

            <div className="flex justify-between items-center pt-2">
              <div className="text-[11px] text-muted-foreground">
                {"테스트 계정: 1/1 (김승현 301호), 2/2 (이번 202호), 3/3 (삼번 203호)"}
              </div>
              <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700">
                {"로그인"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* My Info Dialog */}
      <Dialog open={infoOpen} onOpenChange={setInfoOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{"내 정보"}</DialogTitle>
          </DialogHeader>
          {isLoggedIn ? (
            <div className="text-sm space-y-1">
              <p>
                <span className="text-muted-foreground">{"아이디: "}</span>
                <span className="font-medium">{user?.id}</span>
              </p>
              <p>
                <span className="text-muted-foreground">{"이름: "}</span>
                <span className="font-medium">{user?.name}</span>
              </p>
              <p>
                <span className="text-muted-foreground">{"호실: "}</span>
                <span className="font-medium">{user?.room}</span>
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{"로그인 후 이용 가능합니다."}</p>
          )}
        </DialogContent>
      </Dialog>
    </main>
  )
}

/* Components */
function ProgressRing({
  size = 48,
  strokeWidth = 5,
  progress = 0,
  label,
}: { size?: number; strokeWidth?: number; progress?: number; label?: string }) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const clamped = Math.max(0, Math.min(1, progress))
  const dash = clamped * circumference
  const remainder = circumference - dash

  return (
    <div className="relative" style={{ width: size, height: size }} aria-label={`남은 시간 ${label ?? ""}`}>
      <svg width={size} height={size} className="rotate-[-90deg]">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#e5e7eb"
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#0f766e"
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={`${dash} ${remainder}`}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <span className="text-[10px] font-semibold text-gray-700 leading-none">{label ?? ""}</span>
      </div>
    </div>
  )
}

/* Utils */
function calcDday(target: Date) {
  const today = new Date(new Date().toDateString())
  const td = new Date(target.toDateString())
  const diff = Math.ceil((td.getTime() - today.getTime()) / 86400000)
  const isPast = diff < 0
  return {
    dday: isPast ? `D+${Math.abs(diff)}` : diff === 0 ? "D-DAY" : `D-${diff}`,
    ddayLabel: isPast ? `D+${Math.abs(diff)}` : diff === 0 ? "D-day" : `D-${diff}`,
  }
}
function fmtMonthDay(d: Date) {
  return `${d.getMonth() + 1}월 ${d.getDate()}일`
}
function pad2(n: number) {
  return String(n).padStart(2, "0")
}

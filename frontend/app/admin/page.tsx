"use client"

import Link from "next/link"
import { useMemo, type ReactNode } from "react"
import {
  AlarmClockCheck,
  AlertTriangle,
  ArrowUpRight,
  BellDot,
  ClipboardList,
  FileBarChart2,
  LayoutDashboard,
  ShieldCheck,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { getCurrentUser } from "@/lib/auth"
import { useAdminDashboard } from "@/features/admin/hooks/use-admin-dashboard"
import type { AdminQuickAction } from "@/features/admin/types"

const quickActionIconMap: Record<AdminQuickAction["icon"], ReactNode> = {
  clipboard: <ClipboardList className="size-4 text-emerald-600" aria-hidden />,
  shield: <ShieldCheck className="size-4 text-emerald-600" aria-hidden />,
  bell: <BellDot className="size-4 text-amber-600" aria-hidden />,
  file: <FileBarChart2 className="size-4 text-sky-600" aria-hidden />,
}

type WatchlistItem = {
  id: string
  category: "승인 필요" | "조치 필요" | "시스템 경보"
  title: string
  due: string
  owner: string
  link: string
  severity: "high" | "medium" | "low"
}

const defaultWatchlist: WatchlistItem[] = [
  {
    id: "fridge-lock",
    category: "조치 필요",
    title: "A동 냉장고 2칸 잠금 해제 요청",
    due: "오늘 14:00 마감",
    owner: "3층 층별장",
    link: "/admin/fridge?unit=A&compartment=2",
    severity: "high",
  },
  {
    id: "penalty-review",
    category: "승인 필요",
    title: "벌점 3건 승격 검토",
    due: "오늘 18:00",
    owner: "운영 관리자",
    link: "/admin/users#penalty-summary",
    severity: "medium",
  },
  {
    id: "laundry-incident",
    category: "시스템 경보",
    title: "세탁실 1호기 오류 감지",
    due: "모니터링 중",
    owner: "설비팀",
    link: "/admin/laundry",
    severity: "low",
  },
]

const moduleSnapshots = [
  {
    id: "fridge",
    label: "냉장고",
    summary: "층별 임박 12건 · 검사 예정 3건",
    metrics: [
      { label: "임박 물품", value: "12", trend: "+2", tone: "warn" as const },
      { label: "폐기 조치", value: "3", trend: "-1", tone: "critical" as const },
      { label: "검사 진행률", value: "78%", trend: "+8", tone: "ok" as const },
    ],
    link: "/admin/fridge",
    memo: "오늘 14:00 검사 세션 잠금 해제 예정",
  },
  {
    id: "laundry",
    label: "세탁실",
    summary: "가동률 64% · 노쇼 신고 2건",
    metrics: [
      { label: "사용 중 기기", value: "7/12", trend: "-1", tone: "ok" as const },
      { label: "노쇼 신고", value: "2", trend: "+1", tone: "warn" as const },
      { label: "정지 기기", value: "1", trend: "=", tone: "critical" as const },
    ],
    link: "/admin/laundry",
    memo: "1호기 히터 점검 필요 — 설비팀 배정 완료",
  },
  {
    id: "library",
    label: "도서관",
    summary: "예약 대기 9건 · 연체 대응 3건",
    metrics: [
      { label: "대출 중", value: "128", trend: "+4", tone: "ok" as const },
      { label: "연체", value: "3", trend: "=", tone: "warn" as const },
      { label: "예약 대기", value: "9", trend: "+2", tone: "ok" as const },
    ],
    link: "/admin/library",
    memo: "이번 주 인기 도서 5권 재입고 예정",
  },
  {
    id: "multipurpose",
    label: "다목적실",
    summary: "이용률 72% · 노쇼 경고 1건",
    metrics: [
      { label: "금일 예약", value: "18", trend: "+2", tone: "ok" as const },
      { label: "노쇼", value: "1", trend: "=", tone: "warn" as const },
      { label: "제재 중", value: "2", trend: "=", tone: "medium" as const },
    ],
    link: "/admin/multipurpose",
    memo: "18시 예약 시간대 혼잡 — 층별 공지 발송 예정",
  },
]

type MetricTone = "ok" | "warn" | "critical" | "medium"

const toneClassMap: Record<MetricTone, string> = {
  ok: "text-emerald-600",
  warn: "text-amber-600",
  critical: "text-red-600",
  medium: "text-sky-600",
}

export default function AdminPage() {
  return <AdminDashboard />
}

function AdminDashboard() {
  const currentUser = getCurrentUser()
  const { data, loading } = useAdminDashboard()

  const summaryCards = useMemo(() => {
    if (data?.summary && data.summary.length > 0) {
      return data.summary
    }
    return [
      { id: "inventory", label: "층별 물품", value: "--", description: "데이터 로딩 중" },
      { id: "expiry", label: "임박·만료", value: "--", description: "데이터 로딩 중" },
      { id: "inspection", label: "검사 진행률", value: "--", description: "데이터 로딩 중" },
      { id: "notification", label: "알림 성공률", value: "--", description: "데이터 로딩 중" },
    ]
  }, [data?.summary])

  const timeline = data?.timeline ?? []
  const quickActions = data?.quickActions ?? []

  const watchlistItems = defaultWatchlist

  return (
    <>
      <div data-admin-slot="main" className="space-y-8">
        <section className="rounded-3xl border border-emerald-100 bg-gradient-to-r from-emerald-50 via-white to-white px-8 py-10 shadow-sm">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="space-y-3">
              <Badge variant="outline" className="border-emerald-300 bg-white/60 text-emerald-700">
                운영 허브
              </Badge>
              <h1 className="text-2xl font-semibold text-slate-900 md:text-3xl">
                {currentUser?.name ?? "관리자"}님, 오늘도 안정적인 운영을 이어가볼까요?
              </h1>
              <p className="max-w-2xl text-sm text-slate-600">
                데모 목표는 10분 내 “거주자 → 층별장 → 관리자” 흐름을 매끄럽게 보여주는 것입니다. 아래 워치리스트와 빠른 실행으로 우선순위를 점검하고, 필요한 작업을 즉시 처리하세요.
              </p>
            </div>
            <div className="rounded-2xl border border-emerald-100 bg-white/80 p-5 text-sm text-slate-600">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">오늘의 체크포인트</p>
              <ul className="mt-3 list-disc space-y-1 pl-5">
                <li>14:00 냉장고 검사 세션 잠금 해제 확인</li>
                <li>18:00 벌점 승격 승인 마감</li>
                <li>세탁실 1호기 점검 결과 업데이트</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">핵심 지표</h2>
              <p className="text-sm text-slate-500">층별 현황, 임박 물품, 검사 진행률, 알림 성공률을 한눈에 확인하세요.</p>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/audit">감사 로그 보기</Link>
            </Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {summaryCards.map((item) => (
              <Card key={item.id ?? item.label} className="border-emerald-100 bg-white/90 shadow-sm">
                <CardHeader className="pb-1">
                  <CardDescription className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    {item.label}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold text-emerald-700">{item.value}</p>
                  <p className="mt-2 text-xs text-slate-500">{item.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">모듈 스냅샷</h2>
              <p className="text-sm text-slate-500">모듈별 핵심 지표와 운영 메모를 확인하고 필요한 화면으로 이동하세요.</p>
            </div>
            <Button asChild variant="ghost" size="sm" className="text-emerald-600">
              <Link href="/admin/resources">
                자원 관리 이동
                <ArrowUpRight className="ml-1 size-4" aria-hidden />
              </Link>
            </Button>
          </div>
          <Tabs defaultValue="fridge" className="w-full">
            <TabsList className="grid h-auto grid-cols-2 gap-2 bg-slate-100 p-2 sm:grid-cols-4">
              {moduleSnapshots.map((module) => (
                <TabsTrigger key={module.id} value={module.id} className="rounded-xl text-xs sm:text-sm">
                  {module.label}
                </TabsTrigger>
              ))}
            </TabsList>
            {moduleSnapshots.map((module) => (
              <TabsContent key={module.id} value={module.id} className="mt-4">
                <Card className="border-slate-200 shadow-sm">
                  <CardHeader className="flex flex-col gap-2 border-b border-slate-100 pb-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <CardTitle className="text-base font-semibold text-slate-900">{module.label}</CardTitle>
                      <CardDescription className="text-sm text-slate-600">{module.summary}</CardDescription>
                    </div>
                    <Button asChild size="sm" variant="outline">
                      <Link href={module.link}>
                        상세 보기
                        <ArrowUpRight className="ml-1 size-4" aria-hidden />
                      </Link>
                    </Button>
                  </CardHeader>
                  <CardContent className="grid gap-4 pt-4 md:grid-cols-4">
                    {module.metrics.map((metric) => (
                      <div key={metric.label} className="space-y-1 rounded-xl border border-slate-100 bg-slate-50/60 p-4">
                        <p className="text-xs font-medium text-slate-500">{metric.label}</p>
                        <p className={cn("text-xl font-semibold", toneClassMap[metric.tone])}>{metric.value}</p>
                        <p className="text-xs text-slate-400">전일 대비 {metric.trend}</p>
                      </div>
                    ))}
                    <div className="md:col-span-4">
                      <Separator className="my-4" />
                      <p className="text-sm text-slate-600">{module.memo}</p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            ))}
          </Tabs>
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold text-slate-900">운영 워치리스트</CardTitle>
                <CardDescription className="text-sm text-slate-500">지금 처리해야 할 승인/조치/경보 항목입니다.</CardDescription>
              </div>
              <Button asChild size="sm" variant="outline">
                <Link href="/admin/tools">운영 도구 열기</Link>
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {watchlistItems.map((item) => (
                <Link key={item.id} href={item.link} className="block rounded-xl border border-slate-200 bg-white/80 p-4 transition hover:border-emerald-200 hover:shadow">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className={cn("border-transparent", item.severity === "high" && "bg-red-50 text-red-600", item.severity === "medium" && "bg-amber-50 text-amber-600", item.severity === "low" && "bg-sky-50 text-sky-600")}> 
                      {item.category}
                    </Badge>
                    <span className="text-sm font-semibold text-slate-900">{item.title}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                    <span>담당: {item.owner}</span>
                    <span>마감: {item.due}</span>
                  </div>
                </Link>
              ))}
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold text-slate-900">최근 이벤트</CardTitle>
                <CardDescription className="text-sm text-slate-500">지난 24시간 내 주요 이벤트를 확인하세요.</CardDescription>
              </div>
              <AlarmClockCheck className="size-5 text-emerald-600" aria-hidden />
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              {timeline.length === 0 && loading ? (
                <p className="text-xs text-slate-500">타임라인을 불러오는 중입니다…</p>
              ) : timeline.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-4 text-xs text-slate-500">
                  표시할 이벤트가 없습니다. 검사/알림/벌점 활동이 기록되면 자동으로 채워집니다.
                </div>
              ) : (
                timeline.map((event) => (
                  <div key={event.id ?? event.time} className="flex gap-3">
                    <span className="mt-0.5 min-w-[56px] text-xs font-semibold text-emerald-600">{event.time}</span>
                    <div className="flex-1 rounded-xl border border-slate-200 bg-white/70 p-3">
                      <p className="font-medium text-slate-900">{event.title}</p>
                      <p className="text-xs text-slate-500">{event.detail}</p>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </section>

        <section className="space-y-4">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base font-semibold text-slate-900">운영 가이드</CardTitle>
              <CardDescription className="text-sm text-slate-500">
                모듈별 운영 원칙과 데모 시 주의사항을 요약했습니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                <h3 className="text-sm font-semibold text-slate-900">냉장고</h3>
                <p className="mt-2 text-xs text-slate-600">검사 시작 시 칸 잠금 → 조치 기록 → 제출 요약 흐름을 강조하고, 잠금 해제 후 거주자 화면이 즉시 복구되는지 확인하세요.</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                <h3 className="text-sm font-semibold text-slate-900">세탁실</h3>
                <p className="mt-2 text-xs text-slate-600">노쇼 신고와 벌점 연동, 기기 상태 전환 흐름을 소개합니다. 오류 기기 발생 시 Danger Zone 모달 확인을 강조하세요.</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                <h3 className="text-sm font-semibold text-slate-900">도서관 · 다목적실</h3>
                <p className="mt-2 text-xs text-slate-600">Phase 2 확장 모듈로, 알림/벌점 정책과 동일 프레임워크를 공유함을 알리고, 현재는 조회 위주임을 명시합니다.</p>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>

      <div data-admin-slot="rail" className="space-y-6">
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-800">빠른 실행</h2>
          <p className="text-xs text-slate-500">관리 허브와 동일 폼을 재사용하며, 감사 로그에는 source=shortcut으로 기록됩니다.</p>
          <div className="space-y-3">
            {quickActions.length === 0 && loading ? (
              <p className="text-xs text-slate-500">빠른 실행 항목을 불러오는 중입니다…</p>
            ) : quickActions.length === 0 ? (
              <p className="text-xs text-slate-500">등록된 빠른 실행이 없습니다. 관리 허브에서 즐겨찾기를 추가해 보세요.</p>
            ) : (
              quickActions.map((action) => (
                <Link key={action.title} href={action.href} className="flex items-center justify-between rounded-xl border border-emerald-100 bg-white/90 px-3 py-2 text-sm font-medium text-slate-800 transition hover:border-emerald-300 hover:text-emerald-700">
                  <span className="flex items-center gap-2">
                    {quickActionIconMap[action.icon] ?? <ArrowUpRight className="size-4 text-emerald-600" aria-hidden />}
                    {action.title}
                  </span>
                  <ArrowUpRight className="size-4" aria-hidden />
                </Link>
              ))
            )}
          </div>
        </section>
        <Separator />
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-800">운영 런북</h2>
          <ul className="space-y-2 text-xs text-slate-600">
            <li className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 size-4 text-amber-500" aria-hidden />
              <span>
                <strong className="text-slate-800">데모 데이터 초기화</strong> — `/admin/seed/fridge-demo` 실행 전 운영 DB 여부를 반드시 확인하세요.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <BellDot className="mt-0.5 size-4 text-emerald-500" aria-hidden />
              <span>
                <strong className="text-slate-800">임박 알림</strong> — 09:00 배치를 테스트할 때는 알림 정책 탭에서 `테스트 발송`을 먼저 실행하세요.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <ClipboardList className="mt-0.5 size-4 text-slate-500" aria-hidden />
              <span>
                <strong className="text-slate-800">검사 보고</strong> — 제출 요약 이후 감사 로그 탭에서 `냉장고 검사` 프리셋으로 바로 이동할 수 있습니다.
              </span>
            </li>
          </ul>
        </section>
      </div>
    </>
  )
}

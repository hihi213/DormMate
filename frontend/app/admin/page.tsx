"use client"

import Link from "next/link"
import {
  AlarmClockCheck,
  AlertTriangle,
  ArrowUpRight,
  BellDot,
  ClipboardList,
  FileText,
  ShieldCheck,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { getCurrentUser } from "@/lib/auth"
import { useAdminDashboard } from "@/features/admin/hooks/use-admin-dashboard"
import type { AdminQuickAction } from "@/features/admin/types"

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
    title: "냉장고 2칸 잠금 해제 요청",
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
    summary: "임박 물품 12건 · 검사 예정 3건",
    metrics: [
      { label: "임박 물품", value: "12", trend: "+2", tone: "warn" as const },
      { label: "폐기 조치", value: "3", trend: "-1", tone: "critical" as const },
      { label: "검사 진행률", value: "78%", trend: "+8", tone: "ok" as const },
      { label: "알림 실패", value: "1", trend: "3건", tone: "critical" as const },
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
      { label: "알림 실패", value: "0", trend: "0건", tone: "ok" as const },
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
      { label: "알림 실패", value: "2", trend: "5건", tone: "critical" as const },
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
      { label: "알림 실패", value: "0", trend: "0건", tone: "ok" as const },
    ],
    link: "/admin/multipurpose",
    memo: "18시 예약 시간대 혼잡 — 층별 공지 발송 예정",
  },
]

const defaultQuickActions = [
  {
    id: "compartment",
    title: "냉장고 칸 운영",
    description: "냉장고 관제실에서 허용량·잠금을 조정",
    href: "/admin/fridge",
    icon: "clipboard",
  },
  {
    id: "promote",
    title: "층별장 임명",
    description: "권한·계정 화면에서 승격/복귀 처리",
    href: "/admin/users",
    icon: "shield",
  },
  {
    id: "policy",
    title: "알림 정책 편집",
    description: "09:00 배치, 상한, dedupe 키를 즉시 변경",
    href: "/admin/notifications",
    icon: "bell",
  },
  {
    id: "report",
    title: "보고서 내려받기",
    description: "검사·알림·벌점 통합 리포트를 확인",
    href: "/admin/audit",
    icon: "file",
  },
] satisfies AdminQuickAction[]

type MetricTone = "ok" | "warn" | "critical" | "medium"

const toneClassMap: Record<MetricTone, string> = {
  ok: "text-emerald-600",
  warn: "text-amber-600",
  critical: "text-red-600",
  medium: "text-sky-600",
}

const quickActionIcons: Record<string, LucideIcon> = {
  clipboard: ClipboardList,
  shield: ShieldCheck,
  bell: BellDot,
  file: FileText,
}

export default function AdminPage() {
  return <AdminDashboard />
}

function AdminDashboard() {
  const currentUser = getCurrentUser()
  const { data, loading } = useAdminDashboard()

  const timeline = data?.timeline ?? []
  const watchlistItems = defaultWatchlist
  const quickActions = data?.quickActions ?? defaultQuickActions

  return (
    <>
      <div data-admin-slot="main" className="space-y-8">
        <section className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-slate-900">모듈 스냅샷</h2>
            <p className="text-sm text-slate-500">모듈별 핵심 지표와 운영 메모를 확인하고 필요한 화면으로 이동하세요.</p>
          </div>
          <Tabs defaultValue="fridge" className="w-full">
            <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
              <TabsList className="flex h-auto gap-2 overflow-x-auto bg-slate-50 p-4">
                {moduleSnapshots.map((module) => (
                  <TabsTrigger
                    key={module.id}
                    value={module.id}
                    className="shrink-0 rounded-full border border-transparent bg-white/70 px-4 py-2 text-xs font-medium text-slate-600 shadow-sm transition hover:border-emerald-200 hover:text-emerald-700 data-[state=active]:border-emerald-200 data-[state=active]:bg-emerald-50/80 data-[state=active]:text-emerald-700 sm:text-sm"
                  >
                    {module.label}
                  </TabsTrigger>
                ))}
              </TabsList>
              {moduleSnapshots.map((module) => (
                <TabsContent key={module.id} value={module.id} className="p-0">
                  <div className="space-y-5 border-t border-slate-100 p-6">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
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
                    </div>
                    <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
                      {module.metrics.map((metric) => (
                        <div key={metric.label} className="space-y-1 rounded-xl border border-slate-100 bg-slate-50/60 p-4">
                          <p className="text-xs font-medium text-slate-500">{metric.label}</p>
                          <p className={cn("text-xl font-semibold", toneClassMap[metric.tone])}>{metric.value}</p>
                          <p className="text-xs text-slate-400">
                            {metric.label.includes("알림 실패")
                              ? `재시도 대기 ${metric.trend}`
                              : `전주 대비 ${metric.trend}`}
                          </p>
                        </div>
                      ))}
                    </div>
                    <Separator />
                    <p className="text-sm text-slate-600">{module.memo}</p>
                  </div>
                </TabsContent>
              ))}
            </div>
          </Tabs>
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold text-slate-900">운영 워치리스트</CardTitle>
                <CardDescription className="text-sm text-slate-500">지금 처리해야 할 승인/조치/경보 항목입니다.</CardDescription>
              </div>
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

      </div>

      <div data-admin-slot="rail" className="space-y-6">
        {quickActions.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-slate-800">빠른 작업</h2>
            <ul className="space-y-2">
              {quickActions.map((action) => {
                const Icon = quickActionIcons[action.icon] ?? ArrowUpRight
                return (
                  <li key={action.id}>
                    <Link
                      href={action.href}
                      className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-left shadow-sm transition hover:border-emerald-200 hover:shadow-md"
                    >
                      <div className="flex flex-1 flex-col">
                        <span className="text-sm font-semibold text-slate-900">{action.title}</span>
                        <span className="text-xs text-slate-500">{action.description}</span>
                      </div>
                      <Icon className="ml-3 size-4 text-emerald-600" aria-hidden />
                    </Link>
                  </li>
                )
              })}
            </ul>
          </section>
        )}

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

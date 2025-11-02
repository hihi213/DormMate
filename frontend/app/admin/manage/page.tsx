"use client"

import Link from "next/link"
import { Boxes, ClipboardList, FileBarChart, Hammer, Siren, Users } from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

const HUB_SECTIONS = [
  {
    title: "자원 관리",
    description: "냉장고·세탁실·도서관·다목적실 자원과 칸/슬롯 상태, 라벨 범위를 조정합니다.",
    href: "/admin/manage/resources",
    icon: Boxes,
  },
  {
    title: "권한·계정",
    description: "층별장 승격/복귀, 관리자 임명, 계정 비활성화와 감사 로그를 확인합니다.",
    href: "/admin/manage/roles",
    icon: Users,
  },
  {
    title: "알림·정책",
    description: "발송 상한·TTL·배치 시각과 벌점 제재 정책을 조정하고 테스트 발송을 수행합니다.",
    href: "/admin/manage/policies",
    icon: Siren,
  },
  {
    title: "리포트·감사",
    description: "검사·알림·벌점 통계를 CSV/PDF로 내려받고 감사 로그를 조회합니다.",
    href: "/admin/manage/reports",
    icon: FileBarChart,
  },
  {
    title: "운영 도구",
    description: "데모 Seed, 환경 플래그, 시스템 모니터링 등 위험 작업을 관리합니다.",
    href: "/admin/manage/tools",
    icon: Hammer,
  },
]

export default function AdminManageHomePage() {
  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-xl font-semibold text-slate-800">관리 허브</h1>
        <p className="text-sm text-muted-foreground">
          자원/권한/정책을 중앙에서 통제합니다. 각 카드의 &ldquo;바로 가기&rdquo; 버튼은 동일 폼을 공유하는 상세 화면으로 이동하며, 모든 조치는 감사 로그에 기록됩니다.
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        {HUB_SECTIONS.map((section) => {
          const Icon = section.icon
          return (
            <Card key={section.title} className="border-emerald-50 shadow-sm transition hover:border-emerald-200">
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
                <div className="flex items-center gap-3">
                  <span className="rounded-full bg-emerald-100 p-2">
                    <Icon className="size-4 text-emerald-700" aria-hidden />
                  </span>
                  <CardTitle className="text-base font-semibold text-slate-900">
                    {section.title}
                  </CardTitle>
                </div>
                <Button asChild size="sm" variant="outline">
                  <Link href={section.href}>바로 가기</Link>
                </Button>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-sm text-muted-foreground">
                  {section.description}
                </CardDescription>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Card className="border-amber-100 bg-amber-50/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-amber-800">
            운영 정책 유의사항
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-xs text-amber-900">
          <p>• 모듈 탭(냉장고·세탁실 등)은 현황 위젯과 관리 허브 링크만 제공하며, 설정 변경은 여기에서만 수행합니다.</p>
          <p>• 빠른 실행 카드는 동일 폼을 재사용하므로 중복 UI를 만들지 않습니다.</p>
          <p>• 위험 작업은 운영 도구에서 Danger Zone 모달을 통해 확인 후 실행합니다.</p>
        </CardContent>
      </Card>
    </section>
  )
}

"use client"

import Link from "next/link"
import { Activity, Cpu } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"

export default function AdminSystemPage() {
  return (
    <>
      <div data-admin-slot="main" className="space-y-6">
        <header className="rounded-3xl border border-emerald-100 bg-white/90 p-6 shadow-sm">
          <div className="flex flex-col gap-2">
            <Badge variant="outline" className="w-fit border-emerald-200 bg-emerald-50 text-emerald-700">
              시스템 설정
            </Badge>
            <h1 className="text-2xl font-semibold text-slate-900">시스템 모니터링 (미리보기)</h1>
            <p className="text-sm text-slate-600">
              CPU/메모리/디스크, API 응답 시간을 시각화하는 대시보드는 Post-MVP에서 연동됩니다. 현재는 Docker/Prometheus 대시보드를 활용하세요.
            </p>
          </div>
        </header>

        <Card className="rounded-3xl border border-slate-200 bg-white/90 shadow-sm">
          <CardHeader className="flex flex-row items-center gap-3">
            <span className="rounded-full bg-slate-200 p-2">
              <Cpu className="size-4 text-slate-600" aria-hidden />
            </span>
            <div>
              <CardTitle className="text-base font-semibold">시스템 설정 (준비 중)</CardTitle>
              <CardDescription className="text-xs text-slate-500">
                환경 변수, 모니터링, 감사 로그 연동 설정은 차기 버전에서 제공됩니다.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-600">
            <p>현재 시스템 설정은 `.env`와 Docker Compose를 통해 관리됩니다. UI 연동은 운영 자동화 계획과 함께 제공됩니다.</p>
            <p>로그/모니터링 대시보드는 Grafana/Prometheus 내보내기 링크로 공유할 예정입니다.</p>
            <Separator />
            <p className="text-xs text-slate-500">향후 확장: SLA 모니터링, 환경 변수 편집, 런북 연동.</p>
          </CardContent>
        </Card>
      </div>

      <div data-admin-slot="rail" className="space-y-4 text-sm">
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-slate-800">관련 링크</h2>
          <p>
            <Link className="text-emerald-600 hover:underline" href="/admin/audit?module=system">
              시스템 감사 로그
            </Link>
          </p>
          <p>
            <Link className="text-emerald-600 hover:underline" href="/admin/tools">
              운영 도구
            </Link>
          </p>
        </section>
        <Separator />
        <section className="space-y-2 text-xs text-slate-600">
          <h3 className="text-sm font-semibold text-slate-800">모니터링 메모</h3>
          <div className="flex items-start gap-2">
            <Activity className="mt-0.5 size-4 text-slate-400" aria-hidden />
            <span>현재는 Prometheus 대시보드에서 실시간 지표를 확인하고, 이상 시 Slack 알림으로 공유합니다.</span>
          </div>
        </section>
      </div>
    </>
  )
}

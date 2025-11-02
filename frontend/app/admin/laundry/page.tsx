"use client"

import Link from "next/link"
import { Clock3, Waves } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"

export default function AdminLaundryPage() {
  return (
    <>
      <div data-admin-slot="main" className="space-y-6">
        <header className="rounded-3xl border border-emerald-100 bg-white/90 p-6 shadow-sm">
          <div className="flex flex-col gap-2">
            <Badge variant="outline" className="w-fit border-emerald-200 bg-emerald-50 text-emerald-700">
              세탁실
            </Badge>
            <h1 className="text-2xl font-semibold text-slate-900">세탁실 현황 (미리보기)</h1>
            <p className="text-sm text-slate-600">
              가동 중 기기, 노쇼 신고, 운영 로그는 Post-MVP에서 본격적으로 연동됩니다. 현재는 관리자 대시보드의 요약 통계를 참고하세요.
            </p>
          </div>
        </header>

        <Card className="rounded-3xl border border-slate-200 bg-white/90 shadow-sm">
          <CardHeader className="flex flex-row items-center gap-3">
            <span className="rounded-full bg-sky-100 p-2">
              <Waves className="size-4 text-sky-600" aria-hidden />
            </span>
            <div>
              <CardTitle className="text-base font-semibold">세탁실 모듈 (준비 중)</CardTitle>
              <CardDescription className="text-xs text-slate-500">
                기기 상태, 노쇼 신고, 벌점 연동 UI는 차기 버전에서 제공됩니다.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-600">
            <p>세탁실 운영 기능은 현재 백엔드 API와 QA 계획을 정비 중입니다. UI는 관리자 대시보드 → 세탁 탭에서 확인 가능합니다.</p>
            <p>
              가동률, 오류 기기, 신고 큐는 추후 실시간 정보를 제공하며, 현재는 운영 로그에서 수동으로 확인해 주세요.
            </p>
            <Separator />
            <p className="text-xs text-slate-500">향후 확장: SSE 기반 실시간 상태, 노쇼 신고 처리, 벌점 자동 부여.</p>
          </CardContent>
        </Card>
      </div>

      <div data-admin-slot="rail" className="space-y-4 text-sm">
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-slate-800">관련 링크</h2>
          <p>
            <Link className="text-emerald-600 hover:underline" href="/admin/audit?module=laundry">
              세탁실 감사 로그
            </Link>
          </p>
          <p>
            <Link className="text-emerald-600 hover:underline" href="/admin/notifications">
              노쇼 알림 정책
            </Link>
          </p>
        </section>
        <Separator />
        <section className="space-y-2 text-xs text-slate-600">
          <h3 className="text-sm font-semibold text-slate-800">준비 중 기능</h3>
          <div className="flex items-start gap-2">
            <Clock3 className="mt-0.5 size-4 text-slate-400" aria-hidden />
            <span>기기 상태 모니터링, 신고 큐, 벌점 연동이 UI에 추가될 예정입니다.</span>
          </div>
        </section>
      </div>
    </>
  )
}

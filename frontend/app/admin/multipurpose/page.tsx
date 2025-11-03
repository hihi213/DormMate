"use client"

import Link from "next/link"
import { CalendarClock, UsersRound } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"

export default function AdminMultipurposePage() {
  return (
    <>
      <div data-admin-slot="main" className="space-y-6">
        <header className="rounded-3xl border border-emerald-100 bg-white/90 p-6 shadow-sm">
          <div className="flex flex-col gap-2">
            <Badge variant="outline" className="w-fit border-emerald-200 bg-emerald-50 text-emerald-700">
              다목적실
            </Badge>
            <h1 className="text-2xl font-semibold text-slate-900">다목적실 예약 (미리보기)</h1>
            <p className="text-sm text-slate-600">
              예약 일정, 노쇼 신고, 벌점 연동 UI는 Post-MVP 확장 계획입니다. 현재는 관리자 대시보드에서 예약 통계를 참고하세요.
            </p>
          </div>
        </header>

        <Card className="rounded-3xl border border-slate-200 bg-white/90 shadow-sm">
          <CardHeader className="flex flex-row items-center gap-3">
            <span className="rounded-full bg-amber-100 p-2">
              <CalendarClock className="size-4 text-amber-600" aria-hidden />
            </span>
            <div>
              <CardTitle className="text-base font-semibold">다목적실 모듈 (준비 중)</CardTitle>
              <CardDescription className="text-xs text-slate-500">
                예약 캘린더, 노쇼 신고, 벌점 연동 기능은 차기 버전에서 제공됩니다.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-600">
            <p>10분 단위 예약, 합석 옵션, 노쇼 신고 프로세스는 디자인 시안 확정 후 구현됩니다.</p>
            <p>임시로 관리자 대시보드에서 예약 현황을 체크하고, 신고는 감사 로그를 참고하세요.</p>
            <Separator />
            <p className="text-xs text-slate-500">향후 확장: 예약 캘린더, 노쇼 벌점 처리, 자동 공지.</p>
          </CardContent>
        </Card>
      </div>

      <div data-admin-slot="rail" className="space-y-4 text-sm">
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-slate-800">관련 링크</h2>
          <p>
            <Link className="text-emerald-600 hover:underline" href="/admin/notifications">
              예약 알림 정책
            </Link>
          </p>
          <p>
            <Link className="text-emerald-600 hover:underline" href="/admin/audit?module=multipurpose">
              다목적실 감사 로그
            </Link>
          </p>
        </section>
        <Separator />
        <section className="space-y-2 text-xs text-slate-600">
          <h3 className="text-sm font-semibold text-slate-800">준비 중 기능</h3>
          <div className="flex items-start gap-2">
            <UsersRound className="mt-0.5 size-4 text-slate-400" aria-hidden />
            <span>합석 옵션, 노쇼 신고, 벌점 연동이 추가될 예정입니다.</span>
          </div>
        </section>
      </div>
    </>
  )
}

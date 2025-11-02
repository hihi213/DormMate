"use client"

import Link from "next/link"
import { BookOpen, CalendarDays } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"

export default function AdminLibraryPage() {
  return (
    <>
      <div data-admin-slot="main" className="space-y-6">
        <header className="rounded-3xl border border-emerald-100 bg-white/90 p-6 shadow-sm">
          <div className="flex flex-col gap-2">
            <Badge variant="outline" className="w-fit border-emerald-200 bg-emerald-50 text-emerald-700">
              도서관
            </Badge>
            <h1 className="text-2xl font-semibold text-slate-900">도서관 관리 (미리보기)</h1>
            <p className="text-sm text-slate-600">
              도서 검색/대출/예약 관리 UI는 Post-MVP 확장 계획에 맞춰 제공됩니다. 현재는 관리자 대시보드에서 요약 통계를 확인해 주세요.
            </p>
          </div>
        </header>

        <Card className="rounded-3xl border border-slate-200 bg-white/90 shadow-sm">
          <CardHeader className="flex flex-row items-center gap-3">
            <span className="rounded-full bg-indigo-100 p-2">
              <BookOpen className="size-4 text-indigo-600" aria-hidden />
            </span>
            <div>
              <CardTitle className="text-base font-semibold">도서관 모듈 (준비 중)</CardTitle>
              <CardDescription className="text-xs text-slate-500">
                도서 대출, 예약, 연체 관리 기능은 차기 버전에서 연동됩니다.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-600">
            <p>외부 도서 API 연동 및 검색 UI는 현재 스펙 정의 중입니다. 임시로 관리자 대시보드에서 대출/연체 요약만 제공됩니다.</p>
            <p>예약 대기 알림, 자동 취소 정책은 알림·정책 화면에서 관리됩니다.</p>
            <Separator />
            <p className="text-xs text-slate-500">향후 확장: 도서 검색, 예약/대출 타임라인, 연체 벌점 자동화.</p>
          </CardContent>
        </Card>
      </div>

      <div data-admin-slot="rail" className="space-y-4 text-sm">
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-slate-800">관련 링크</h2>
          <p>
            <Link className="text-emerald-600 hover:underline" href="/admin/notifications">
              도서 예약 알림 정책
            </Link>
          </p>
          <p>
            <Link className="text-emerald-600 hover:underline" href="/admin/audit?module=library">
              도서관 감사 로그
            </Link>
          </p>
        </section>
        <Separator />
        <section className="space-y-2 text-xs text-slate-600">
          <h3 className="text-sm font-semibold text-slate-800">준비 중 기능</h3>
          <div className="flex items-start gap-2">
            <CalendarDays className="mt-0.5 size-4 text-slate-400" aria-hidden />
            <span>대출/예약 일정, 연체 벌점 처리 UI가 추가될 예정입니다.</span>
          </div>
        </section>
      </div>
    </>
  )
}

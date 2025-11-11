"use client"

import Link from "next/link"
import { BookOpen, CalendarDays } from "lucide-react"

import { Separator } from "@/components/ui/separator"
import { ComingSoonCard } from "@/components/coming-soon-card"

export default function AdminLibraryPage() {
  return (
    <>
      <div data-admin-slot="main" className="space-y-6">
        <ComingSoonCard
          badge="도서관"
          title="도서관 관리 (미리보기)"
          description="도서 검색/대출/예약 관리 UI는 Post-MVP 확장 계획에 맞춰 제공됩니다."
          icon={<BookOpen className="size-4 text-indigo-600" aria-hidden />}
          note="현재는 관리자 대시보드에서 요약 통계를 확인해 주세요."
        >
          <p>외부 도서 API 연동 및 검색 UI는 현재 스펙 정의 중입니다. 임시로 관리자 대시보드에서 대출/연체 요약만 제공됩니다.</p>
          <p>예약 대기 알림, 자동 취소 정책은 알림·정책 화면에서 관리됩니다.</p>
          <Separator />
          <p className="text-xs text-slate-500">향후 확장: 도서 검색, 예약/대출 타임라인, 연체 벌점 자동화.</p>
        </ComingSoonCard>
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

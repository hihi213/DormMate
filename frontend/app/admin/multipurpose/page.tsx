"use client"

import Link from "next/link"
import { CalendarClock, UsersRound } from "lucide-react"

import { Separator } from "@/components/ui/separator"
import { ComingSoonCard } from "@/components/coming-soon-card"

export default function AdminMultipurposePage() {
  return (
    <>
      <div data-admin-slot="main" className="space-y-6">
        <ComingSoonCard
          badge="다목적실"
          title="다목적실 예약 (미리보기)"
          description="예약 일정, 노쇼 신고, 벌점 연동 UI는 Post-MVP 확장 계획입니다."
          icon={<CalendarClock className="size-4 text-amber-600" aria-hidden />}
          note="현재는 관리자 대시보드에서 예약 통계를 참고하세요."
        >
          <p>10분 단위 예약, 합석 옵션, 노쇼 신고 프로세스는 디자인 시안 확정 후 구현됩니다.</p>
          <p>임시로 관리자 대시보드에서 예약 현황을 체크하고, 신고는 감사 로그를 참고하세요.</p>
          <Separator />
          <p className="text-xs text-slate-500">향후 확장: 예약 캘린더, 노쇼 벌점 처리, 자동 공지.</p>
        </ComingSoonCard>
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

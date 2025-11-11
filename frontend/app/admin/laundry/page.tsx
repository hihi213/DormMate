"use client"

import Link from "next/link"
import { Clock3, Waves } from "lucide-react"

import { Separator } from "@/components/ui/separator"
import { ComingSoonCard } from "@/components/coming-soon-card"

export default function AdminLaundryPage() {
  return (
    <>
      <div data-admin-slot="main" className="space-y-6">
        <ComingSoonCard
          badge="세탁실"
          title="세탁실 현황 (미리보기)"
          description="가동 중 기기, 노쇼 신고, 운영 로그는 Post-MVP에서 연동됩니다."
          icon={<Waves className="size-4 text-sky-600" aria-hidden />}
          note="현재는 관리자 대시보드의 요약 통계를 참고하세요."
        >
          <p>세탁실 운영 기능은 현재 백엔드 API와 QA 계획을 정비 중입니다. UI는 관리자 대시보드 → 세탁 탭에서 확인 가능합니다.</p>
          <p>가동률, 오류 기기, 신고 큐는 추후 실시간 정보를 제공하며, 현재는 운영 로그에서 수동으로 확인해 주세요.</p>
          <Separator />
          <p className="text-xs text-slate-500">향후 확장: SSE 기반 실시간 상태, 노쇼 신고 처리, 벌점 자동 부여.</p>
        </ComingSoonCard>
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

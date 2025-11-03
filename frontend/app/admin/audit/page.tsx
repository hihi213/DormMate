"use client"

import { ClipboardList, Download } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"

export default function AdminAuditPage() {
  return (
    <>
      <div data-admin-slot="main" className="space-y-6">
        <header className="rounded-3xl border border-emerald-100 bg-white/90 p-6 shadow-sm">
          <div className="flex flex-col gap-2">
            <Badge variant="outline" className="w-fit border-emerald-200 bg-emerald-50 text-emerald-700">
              감사 로그 & 리포트
            </Badge>
            <h1 className="text-2xl font-semibold text-slate-900">감사 로그 (미리보기)</h1>
            <p className="text-sm text-slate-600">
              필터, Diff, 증빙 첨부 UI는 Post-MVP에서 제공됩니다. 현재는 운영 도구의 로그 내보내기 기능을 활용하세요.
            </p>
          </div>
        </header>

        <Card className="rounded-3xl border border-slate-200 bg-white/90 shadow-sm">
          <CardHeader className="flex flex-row items-center gap-3">
            <span className="rounded-full bg-slate-200 p-2">
              <ClipboardList className="size-4 text-slate-600" aria-hidden />
            </span>
            <div>
              <CardTitle className="text-base font-semibold">감사 로그 프리셋 (준비 중)</CardTitle>
              <CardDescription className="text-xs text-slate-500">
                모듈·액션 필터, 저장된 프리셋, Diff 뷰는 차기 버전에서 제공됩니다.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-600">
            <p>현재 감사 로그는 API 응답(JSON)으로 제공되며, 운영 도구에서 다운로드해 확인할 수 있습니다.</p>
            <p>권한 변경, 알림 발송, 칸 재배분 등 주요 이벤트는 Logstash 파이프라인을 통해 저장되고 있습니다.</p>
            <Separator />
            <Button type="button" size="sm" variant="outline" className="gap-2">
              <Download className="size-4" aria-hidden />
              로그 CSV 다운로드 (준비 중)
            </Button>
          </CardContent>
        </Card>
      </div>

      <div data-admin-slot="rail" className="space-y-4 text-sm">
        <section className="space-y-2 text-xs text-slate-600">
          <h2 className="text-sm font-semibold text-slate-800">운영 메모</h2>
          <p>Post-MVP에서는 감사 로그 필터와 리포트 예약 발송을 UI에서 직접 설정할 수 있습니다.</p>
          <p>현재는 `docker compose logs` 또는 운영 도구 내보내기를 사용해 로그를 확인하세요.</p>
        </section>
      </div>
    </>
  )
}

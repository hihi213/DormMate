"use client"

import Link from "next/link"
import { AlertTriangle, Wrench } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"

export default function AdminToolsPage() {
  return (
    <>
      <div data-admin-slot="main" className="space-y-6">
        <header className="rounded-3xl border border-emerald-100 bg-white/90 p-6 shadow-sm">
          <div className="flex flex-col gap-2">
            <Badge variant="outline" className="w-fit border-emerald-200 bg-emerald-50 text-emerald-700">
              운영 도구
            </Badge>
            <h1 className="text-2xl font-semibold text-slate-900">운영 도구 (준비 중)</h1>
            <p className="text-sm text-slate-600">
              데모 Seed, 환경 플래그, 시스템 모니터링 등 위험 작업은 기존 관리 허브(`/admin/manage/tools`)에서 제공됩니다.
            </p>
          </div>
        </header>

        <Card className="rounded-3xl border border-slate-200 bg-white/90 shadow-sm">
          <CardHeader className="flex flex-row items-center gap-3">
            <span className="rounded-full bg-amber-100 p-2">
              <Wrench className="size-4 text-amber-700" aria-hidden />
            </span>
            <div>
              <CardTitle className="text-base font-semibold">위험 작업 안내</CardTitle>
              <CardDescription className="text-xs text-slate-500">
                데모 데이터 초기화, 환경 변수 변경 등은 승인 절차 후 실행하세요.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-600">
            <p>
              <Link className="text-emerald-600 hover:underline" href="/admin/manage/tools">
                관리 허브 → 운영 도구로 이동
              </Link>
            </p>
            <Separator />
            <div className="flex items-start gap-2 text-xs text-amber-700">
              <AlertTriangle className="mt-0.5 size-4" aria-hidden />
              <span>데모 데이터 초기화 시 운영 DB에서는 절대 실행하지 않도록 주의하세요.</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div data-admin-slot="rail" className="space-y-2 text-xs text-slate-600">
        <p>Post-MVP에서는 운영 로그, Runbook, 플래그 관리 기능을 이 화면으로 통합할 예정입니다.</p>
      </div>
    </>
  )
}

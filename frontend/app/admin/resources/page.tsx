"use client"

import Link from "next/link"
import { Hammer } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"

export default function AdminResourcesPage() {
  return (
    <>
      <div data-admin-slot="main" className="space-y-6">
        <header className="rounded-3xl border border-emerald-100 bg-white/90 p-6 shadow-sm">
          <div className="flex flex-col gap-2">
            <Badge variant="outline" className="w-fit border-emerald-200 bg-emerald-50 text-emerald-700">
              자원 관리
            </Badge>
            <h1 className="text-2xl font-semibold text-slate-900">냉장고 자원 관리 (준비 중)</h1>
            <p className="text-sm text-slate-600">
              칸 증설/감축, 라벨 범위, 호실 재배분 UI는 기존 관리 허브(`/admin/manage/resources`)에서 제공됩니다. 새 화면은 Post-MVP에서 통합될 예정입니다.
            </p>
          </div>
        </header>

        <Card className="rounded-3xl border border-slate-200 bg-white/90 shadow-sm">
          <CardHeader className="flex flex-row items-center gap-3">
            <span className="rounded-full bg-emerald-100 p-2">
              <Hammer className="size-4 text-emerald-700" aria-hidden />
            </span>
            <div>
              <CardTitle className="text-base font-semibold">자원 관리 허브로 이동</CardTitle>
              <CardDescription className="text-xs text-slate-500">
                기존 관리 허브에서 냉장고 증설/감축, 라벨 범위 조정, 호실 재배분을 실행할 수 있습니다.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-600">
            <p>
              <Link className="text-emerald-600 hover:underline" href="/admin/manage/resources">
                관리 허브 → 자원 관리로 이동
              </Link>
            </p>
            <Separator />
            <p className="text-xs text-slate-500">새 자원 관리 UI는 냉장고 카드 뷰와 동일한 데이터 소스를 사용할 예정입니다.</p>
          </CardContent>
        </Card>
      </div>

      <div data-admin-slot="rail" className="space-y-4 text-sm">
        <section className="space-y-2 text-xs text-slate-600">
          <p>증설/재배분 실행 후 감사 로그에서 결과를 확인하세요.</p>
        </section>
      </div>
    </>
  )
}

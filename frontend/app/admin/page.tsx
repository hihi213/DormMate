"use client"

import { useMemo } from "react"
import { BarChart3, Bell, ShieldCheck } from "lucide-react"

import AuthGuard from "@/features/auth/components/auth-guard"
import BottomNav from "@/components/bottom-nav"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { getCurrentUser } from "@/lib/auth"

export default function AdminPage() {
  return (
    <AuthGuard>
      <AdminDashboard />
      <BottomNav />
    </AuthGuard>
  )
}

function AdminDashboard() {
  const currentUser = getCurrentUser()

  const summary = useMemo(
    () => [
      { label: "활성 포장", value: "128", description: "최근 7일 내 등록" },
      { label: "임박/만료", value: "12", description: "24시간 내 처리 필요" },
      { label: "검사 진행", value: "3", description: "층별장 검토 중" },
    ],
    [],
  )

  return (
    <main className="min-h-[100svh] bg-white pb-28">
      <header className="sticky top-0 z-40 border-b bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="mx-auto flex max-w-screen-sm items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-700" />
            <div>
              <p className="text-sm font-medium text-gray-700">DormMate 관리자 대시보드</p>
              <p className="text-xs text-muted-foreground">{currentUser?.name ?? "관리자"}</p>
            </div>
          </div>
          <Badge variant="outline">관리자</Badge>
        </div>
      </header>

      <div className="mx-auto flex max-w-screen-sm flex-col gap-6 px-4 py-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <BarChart3 className="h-4 w-4 text-emerald-700" />
              운영 지표 요약
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            {summary.map((item) => (
              <div key={item.label} className="rounded-lg border bg-slate-50 p-3 text-center">
                <p className="text-xs text-muted-foreground">{item.label}</p>
                <p className="mt-1 text-lg font-semibold text-emerald-700">{item.value}</p>
                <p className="text-[11px] text-muted-foreground">{item.description}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Bell className="h-4 w-4 text-amber-600" />
              오늘의 확인 항목
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>• 층별장 검토 진행 중인 검사 3건 — 결과 제출 여부 확인</p>
            <p>• 임박/만료 알림 12건 — 거주자 대응 상황 파악</p>
            <p>• 보관 칸 용량 조정 요청 2건 — 냉장고 탭에서 세부 조정</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">다음 작업 안내</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>• 냉장고 탭에서 칸 용량·상태를 조정하고 검사 일정 현황을 확인하세요.</p>
            <Separator />
            <p>• 벌점 및 알림 정책 변경 사항은 ops 문서와 함께 관리합니다.</p>
            <p>• 신규 기능(층별장 일정 생성, 관리자 일정 등록)은 SC-401 진행 로그를 참고하세요.</p>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}

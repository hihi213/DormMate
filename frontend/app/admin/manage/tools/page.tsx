"use client"

import { useState } from "react"
import { AlertTriangle, Server, Wrench } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { DangerZoneModal } from "@/components/admin"

export default function AdminToolsPage() {
  const [seedRange, setSeedRange] = useState("2024-11-20")

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-xl font-semibold text-slate-800">운영 도구</h1>
        <p className="text-sm text-muted-foreground">
          데모 Seed, 운영/테스트 환경 전환, 시스템 상태 점검 등 위험 작업을 집중 관리합니다. Production에서는 Danger Zone이 기본 비활성화됩니다.
        </p>
      </header>

      <Card className="shadow-sm">
        <CardHeader className="flex flex-row items-center gap-3">
          <span className="rounded-full bg-slate-200 p-2">
            <Wrench className="size-4 text-slate-700" aria-hidden />
          </span>
          <div>
            <CardTitle className="text-base font-semibold">데모 Seed</CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              `/admin/seed/fridge-demo` 실행 전 데모 기간을 확인하고 운영 DB에서 실행하지 않도록 주의합니다.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="grid gap-1">
            <Label className="text-xs text-muted-foreground">데모 기간 종료일</Label>
            <Input
              type="date"
              value={seedRange}
              onChange={(event) => setSeedRange(event.target.value)}
            />
          </div>
          <DangerZoneModal
            title="데모 데이터를 초기화하시겠습니까?"
            description="현재 저장된 포장·물품 데이터가 모두 삭제되고 전시용 예시 데이터로 덮어씌워집니다. 이 작업은 되돌릴 수 없습니다."
            confirmLabel="데모 데이터 초기화"
            cancelLabel="취소"
            triggerLabel="데모 데이터 초기화"
            onConfirm={async () => undefined}
            destructive
          />
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader className="flex flex-row items-center gap-3">
          <span className="rounded-full bg-emerald-100 p-2">
            <Server className="size-4 text-emerald-700" aria-hidden />
          </span>
          <div>
            <CardTitle className="text-base font-semibold">시스템 상태</CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              API 응답 시간, 에러율, CPU/메모리 사용량을 확인합니다. 알림 Outbox 카드와 데이터 소스를 공유합니다.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p className="text-muted-foreground">• API 평균 응답 210ms · 에러율 0.2%</p>
          <p className="text-muted-foreground">• 백엔드 CPU 사용량 48% · 메모리 62%</p>
          <p className="text-muted-foreground">• Redis 큐 적체 없음, 알림 Outbox 실패 1건 (재시도 필요)</p>
          <Button type="button" size="sm" variant="outline">
            시스템 모니터링 대시보드로 이동
          </Button>
        </CardContent>
      </Card>

      <Card className="border-rose-100 bg-rose-50/60">
        <CardHeader className="flex flex-row items-center gap-3">
          <span className="rounded-full bg-rose-200 p-2">
            <AlertTriangle className="size-4 text-rose-700" aria-hidden />
          </span>
          <div>
            <CardTitle className="text-base font-semibold text-rose-800">Danger Zone 안내</CardTitle>
            <CardDescription className="text-xs text-rose-800/80">
              운영 환경에서는 Feature Flag로 비활성화되며, staging에서만 접근 가능합니다.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="text-xs text-rose-900">
          <ul className="space-y-1">
            <li>• Seed, 환경 전환, 중대한 설정 변경은 모두 DangerZoneModal을 통해 확인합니다.</li>
            <li>• `source` 필드에 shortcut/hub/danger가 기록되어 감사 로그에서 구분됩니다.</li>
            <li>• 실행 후 결과는 관리자 Outbox 또는 시스템 모니터링 위젯에서 즉시 확인하세요.</li>
          </ul>
        </CardContent>
      </Card>
    </section>
  )
}

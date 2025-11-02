"use client"

import { useEffect, useState } from "react"
import { Bell, ShieldAlert } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { DangerZoneModal } from "@/components/admin"
import { useAdminPolicies } from "@/features/admin/hooks/use-admin-policies"

export default function AdminPoliciesPage() {
  const [batchTime, setBatchTime] = useState("09:00")
  const [dailyLimit, setDailyLimit] = useState("20")
  const [ttl, setTtl] = useState("24")
  const [penaltyLimit, setPenaltyLimit] = useState("10")
  const [penaltyTemplate, setPenaltyTemplate] = useState(
    "DormMate 벌점 누적 {점수}점으로 세탁실/다목적실/도서관 이용이 7일간 제한됩니다. 냉장고 기능은 유지됩니다."
  )
  const [autoNotify, setAutoNotify] = useState(true)
  const { data, loading } = useAdminPolicies()

  useEffect(() => {
    if (!data) return
    setBatchTime(data.notification.batchTime)
    setDailyLimit(String(data.notification.dailyLimit))
    setTtl(String(data.notification.ttlHours))
    setPenaltyLimit(String(data.penalty.limit))
    setPenaltyTemplate(data.penalty.template)
  }, [data])

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-xl font-semibold text-slate-800">알림·정책</h1>
        <p className="text-sm text-muted-foreground">
          모듈별 발송 상한, TTL, 배치 시각과 벌점 제재 정책을 관리합니다. 저장 시 즉시 Sandbox 미리보기를 통해 예상 생성 알림 수를 확인합니다.
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center gap-3">
            <span className="rounded-full bg-emerald-100 p-2">
              <Bell className="size-4 text-emerald-700" aria-hidden />
            </span>
            <div>
              <CardTitle className="text-base font-semibold">냉장고 알림 정책</CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                임박/만료 배치, dedupe 키, TTL을 설정합니다.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="grid gap-2">
              <Label className="text-xs text-muted-foreground">배치 시각</Label>
              <Select value={batchTime} onValueChange={setBatchTime}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="시간 선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="07:30">07:30</SelectItem>
                  <SelectItem value="08:00">08:00</SelectItem>
                  <SelectItem value="09:00">09:00</SelectItem>
                  <SelectItem value="10:00">10:00</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label className="text-xs text-muted-foreground">하루 발송 상한</Label>
              <Input
                value={dailyLimit}
                onChange={(event) => setDailyLimit(event.target.value)}
                type="number"
                min={0}
                className="w-[160px]"
              />
            </div>

            <div className="grid gap-2">
              <Label className="text-xs text-muted-foreground">TTL (시간)</Label>
              <Input
                value={ttl}
                onChange={(event) => setTtl(event.target.value)}
                type="number"
                min={1}
                className="w-[160px]"
              />
            </div>

            <div className="grid gap-2">
              <Label className="text-xs text-muted-foreground">테스트 발송 메모</Label>
              <Textarea rows={3} placeholder="예: 임박 알림 정책 변경 테스트" />
            </div>

            <div className="flex items-center gap-3">
              <Switch checked={autoNotify} onCheckedChange={setAutoNotify} id="auto-notify" />
              <Label htmlFor="auto-notify" className="text-xs text-muted-foreground">
                저장 후 자동으로 테스트 발송을 실행합니다.
              </Label>
            </div>

            <div className="flex gap-2">
              <Button type="button" size="sm">
                정책 저장
              </Button>
              <Button type="button" size="sm" variant="outline">
                Sandbox 미리보기
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center gap-3">
            <span className="rounded-full bg-rose-100 p-2">
              <ShieldAlert className="size-4 text-rose-700" aria-hidden />
            </span>
            <div>
              <CardTitle className="text-base font-semibold">벌점·이용 제한</CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                누적 벌점 임계치와 제재 알림 템플릿을 관리합니다.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="grid gap-2">
              <Label className="text-xs text-muted-foreground">누적 벌점 임계치</Label>
              <Input
                value={penaltyLimit}
                onChange={(event) => setPenaltyLimit(event.target.value)}
                type="number"
                min={0}
                className="w-[160px]"
              />
            </div>
            <div className="grid gap-2">
              <Label className="text-xs text-muted-foreground">제재 알림 템플릿</Label>
              <Textarea
                rows={4}
                value={penaltyTemplate}
                onChange={(event) => setPenaltyTemplate(event.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button type="button" size="sm">
                변경 저장
              </Button>
              <Button type="button" size="sm" variant="outline">
                예상 제재 대상 미리보기
              </Button>
            </div>
            <DangerZoneModal
              title="벌점 규칙을 초기화하시겠습니까?"
              description="임계치·알림 템플릿이 기본값으로 되돌아가며, 기존 벌점 기록은 유지됩니다."
              confirmLabel="초기화"
              onConfirm={async () => undefined}
            />
          </CardContent>
        </Card>
        {loading ? <p className="text-xs text-muted-foreground">정책 정보를 불러오는 중입니다…</p> : null}
      </div>
    </section>
  )
}

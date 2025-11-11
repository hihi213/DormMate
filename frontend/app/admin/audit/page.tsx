"use client"

import { useState } from "react"
import { ClipboardList, Download, FileSpreadsheet, History, ListTree } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"

export default function AdminAuditPage() {
  const [reportModule, setReportModule] = useState("all")
  const [from, setFrom] = useState("2025-10-25")
  const [to, setTo] = useState("2025-11-01")

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

        <section className="grid gap-4 lg:grid-cols-2">
          <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-start gap-3">
              <span className="rounded-full bg-emerald-100 p-2">
                <FileSpreadsheet className="size-4 text-emerald-700" aria-hidden />
              </span>
              <div>
                <CardTitle className="text-base font-semibold">통계 리포트</CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  검사·알림·벌점 지표를 통합한 CSV/PDF를 생성합니다.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="grid gap-2">
                <Label className="text-xs text-muted-foreground">대상 모듈</Label>
                <Select value={reportModule} onValueChange={setReportModule}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="모듈 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">전체</SelectItem>
                    <SelectItem value="fridge">냉장고</SelectItem>
                    <SelectItem value="laundry">세탁실</SelectItem>
                    <SelectItem value="library">도서관</SelectItem>
                    <SelectItem value="multipurpose">다목적실</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-wrap gap-3">
                <div className="grid gap-1">
                  <Label className="text-xs text-muted-foreground">시작일</Label>
                  <Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
                </div>
                <div className="grid gap-1">
                  <Label className="text-xs text-muted-foreground">종료일</Label>
                  <Input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
                </div>
              </div>
            </CardContent>
            <CardFooter className="gap-2">
              <Button type="button" size="sm">
                CSV 다운로드
              </Button>
              <Button type="button" size="sm" variant="outline">
                PDF 다운로드
              </Button>
            </CardFooter>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-start gap-3">
              <span className="rounded-full bg-slate-200 p-2">
                <History className="size-4 text-slate-700" aria-hidden />
              </span>
              <div>
                <CardTitle className="text-base font-semibold">감사 로그 스냅샷</CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  권한 변경, 위험 작업, 알림 재발송 등 핵심 이벤트를 빠르게 확인합니다.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center gap-3 rounded-lg border border-dashed border-slate-200 bg-white/70 p-3">
                <ListTree className="size-4 text-emerald-700" aria-hidden />
                <div className="flex-1">
                  <p className="font-medium text-slate-900">최근 이벤트 요약</p>
                  <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
                    <li>• 09:10 층별장 임명 — source=hub (관리자)</li>
                    <li>• 09:05 칸 재배분 — source=shortcut</li>
                    <li>• 09:00 알림 재발송 — Outbox(희망재발송)</li>
                  </ul>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                상세 로그는 `ops` 저장소에 자동 보관됩니다. 필요 시 CSV로 내보내어 감사 위원회에 전달하세요.
              </p>
            </CardContent>
            <CardFooter>
              <Button type="button" size="sm" variant="outline">
                감사 로그 전체 보기
              </Button>
            </CardFooter>
          </Card>
        </section>

        <Card className="border-emerald-100 bg-emerald-50/50">
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-emerald-800">자동 보고 스케줄</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            <p className="text-muted-foreground">
              매주 월요일 09:30에 자동으로 CSV 보고서를 생성해 지정된 이메일(ops@dormmate.io)로 발송합니다. 시간/대상은 ops 문서에서 관리하세요.
            </p>
            <Button type="button" size="sm" variant="outline">
              스케줄 편집 (Ops 문서 열기)
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

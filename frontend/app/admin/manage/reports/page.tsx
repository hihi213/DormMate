"use client"

import { useState } from "react"
import { DownloadCloud, FileSpreadsheet, History, ListTree } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export default function AdminReportsPage() {
  const [from, setFrom] = useState("2025-10-25")
  const [to, setTo] = useState("2025-11-01")
  const [module, setModule] = useState("all")

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-xl font-semibold text-slate-800">리포트·감사</h1>
        <p className="text-sm text-muted-foreground">
          기간별 통계를 내려받고 감사 로그를 조회합니다. CSV/PDF는 다운로드 후 ops 문서와 공유해주세요.
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-start gap-3">
            <span className="rounded-full bg-emerald-100 p-2">
              <FileSpreadsheet className="size-4 text-emerald-700" aria-hidden />
            </span>
            <div>
              <CardTitle className="text-base font-semibold">통계 리포트</CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                검사, 알림, 벌점, 예약 현황을 통합한 CSV/PDF를 생성합니다.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="grid gap-2">
              <Label className="text-xs text-muted-foreground">대상 모듈</Label>
              <Select value={module} onValueChange={setModule}>
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
              <CardTitle className="text-base font-semibold">감사 로그</CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                권한 변경, 위험 작업, 알림 재발송 등의 이벤트를 확인합니다.
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
      </div>

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
    </section>
  )
}

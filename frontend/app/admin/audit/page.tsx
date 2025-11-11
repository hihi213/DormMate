"use client"

import { useEffect, useState } from "react"
import { AlertTriangle, ClipboardList, Download, FileSpreadsheet, History, ListTree, RefreshCcw } from "lucide-react"
import { formatDistanceToNowStrict, parseISO } from "date-fns"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useFridgeOwnershipIssues } from "@/features/admin/hooks/use-fridge-ownership-issues"
import type { FridgeOwnershipIssueItem } from "@/features/admin/api/fridge"

type IssueTone = "critical" | "warn" | "info"

const ISSUE_TYPE_LABELS: Record<string, { label: string; tone: IssueTone }> = {
  NO_ACTIVE_ROOM_ASSIGNMENT: { label: "방 배정 없음", tone: "critical" },
  ROOM_NOT_ALLOWED_FOR_COMPARTMENT: { label: "접근 권한 없음", tone: "warn" },
  UNKNOWN: { label: "확인 필요", tone: "info" },
}

const ISSUE_TONE_CLASSES: Record<IssueTone, string> = {
  critical: "border-rose-200 bg-rose-50 text-rose-700",
  warn: "border-amber-200 bg-amber-50 text-amber-700",
  info: "border-slate-200 bg-slate-50 text-slate-700",
}

const ISSUE_TYPE_HINTS: Record<string, string> = {
  NO_ACTIVE_ROOM_ASSIGNMENT: "소유자에게 활성화된 호실 배정이 없어 라벨 이동이 필요합니다.",
  ROOM_NOT_ALLOWED_FOR_COMPARTMENT: "현재 호실은 해당 칸 접근 권한이 없어 재배분이 필요합니다.",
  UNKNOWN: "원인을 추가 조사해 주세요.",
}

type AuditActionTone = "emerald" | "amber" | "rose" | "slate"

type AuditLogPreviewEntry = {
  id: string
  actionType: "ADMIN_ROLE_PROMOTE" | "ADMIN_ROLE_DEMOTE" | "ADMIN_USER_DEACTIVATED"
  resource: string
  actor: string
  reason?: string
  occurredAt: string
}

const AUDIT_ACTION_META: Record<
  AuditLogPreviewEntry["actionType"],
  { label: string; tone: AuditActionTone }
> = {
  ADMIN_ROLE_PROMOTE: { label: "층별장 임명", tone: "emerald" },
  ADMIN_ROLE_DEMOTE: { label: "층별장 해제", tone: "amber" },
  ADMIN_USER_DEACTIVATED: { label: "계정 비활성화", tone: "rose" },
}

const AUDIT_TONE_CLASSES: Record<AuditActionTone, string> = {
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
  amber: "border-amber-200 bg-amber-50 text-amber-700",
  rose: "border-rose-200 bg-rose-50 text-rose-700",
  slate: "border-slate-200 bg-slate-50 text-slate-600",
}

const AUDIT_LOG_PREVIEW: AuditLogPreviewEntry[] = [
  {
    id: "audit-1",
    actionType: "ADMIN_ROLE_PROMOTE",
    resource: "3F 13-1 (박층장)",
    actor: "admin",
    reason: "검사 공백으로 임시 임명",
    occurredAt: "2025-11-01T09:10:00+09:00",
  },
  {
    id: "audit-2",
    actionType: "ADMIN_ROLE_DEMOTE",
    resource: "2F 05-2 (김도미)",
    actor: "admin",
    reason: "검사 인수인계 완료",
    occurredAt: "2025-10-31T18:40:00+09:00",
  },
  {
    id: "audit-3",
    actionType: "ADMIN_USER_DEACTIVATED",
    resource: "4F 17-3 (이정현)",
    actor: "admin",
    reason: "중도 퇴사 처리",
    occurredAt: "2025-10-30T14:05:00+09:00",
  },
]

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

        <FridgeOwnershipIssuesSection />

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
            <AuditLogPreviewTable entries={AUDIT_LOG_PREVIEW} />
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

function FridgeOwnershipIssuesSection() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const ownerParam = (searchParams.get("ownerId") ?? "").trim()
  const [ownerFilter, setOwnerFilter] = useState<string | null>(ownerParam || null)
  const [ownerInput, setOwnerInput] = useState(ownerParam)
  const ownerInputTrimmed = ownerInput.trim()
  const ownerFilterDisplay = ownerFilter ?? ""
  const inputMatchesFilter = ownerInputTrimmed === ownerFilterDisplay
  const { data, loading, error, refresh } = useFridgeOwnershipIssues({
    size: 20,
    ownerId: ownerFilter,
  })
  const issues = data?.items ?? []
  const handleRefresh = () => {
    void refresh()
  }

  useEffect(() => {
    const nextFilter = ownerParam.length > 0 ? ownerParam : null
    setOwnerFilter((prev) => (prev === nextFilter ? prev : nextFilter))
    setOwnerInput((prev) => (prev === ownerParam ? prev : ownerParam))
  }, [ownerParam])

  const updateOwnerQuery = (next: string | null) => {
    if (!router || !pathname) return
    const params = new URLSearchParams(searchParams.toString())
    if (next) {
      params.set("ownerId", next)
    } else {
      params.delete("ownerId")
    }
    const nextQuery = params.toString()
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false })
  }

  const handleApplyOwnerFilter = () => {
    const nextFilter = ownerInputTrimmed.length > 0 ? ownerInputTrimmed : null
    setOwnerFilter(nextFilter)
    updateOwnerQuery(nextFilter)
  }

  const handleClearOwnerFilter = () => {
    setOwnerInput("")
    setOwnerFilter(null)
    updateOwnerQuery(null)
  }

  return (
    <Card className="rounded-3xl border border-rose-100 bg-white/95 shadow-sm">
      <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3">
          <span className="rounded-full bg-rose-100 p-2">
            <AlertTriangle className="size-4 text-rose-700" aria-hidden />
          </span>
          <div className="space-y-1">
            <CardTitle className="text-base font-semibold text-slate-900">냉장고 권한 불일치 모니터</CardTitle>
            <CardDescription className="text-xs text-slate-500">
              포장 소유자·호실 배정·칸 권한이 불일치하는 항목을 즉시 확인합니다.
            </CardDescription>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="border-rose-200 bg-rose-50 text-rose-700">
            {ownerFilter ? `필터 ${issues.length}건` : `표시 중 ${issues.length}건`}
          </Badge>
          <Button type="button" size="sm" variant="outline" onClick={handleRefresh} disabled={loading} className="gap-2">
            <RefreshCcw className={`size-4 ${loading ? "animate-spin" : ""}`} aria-hidden />
            새로 고침
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2 rounded-xl border border-slate-200/80 bg-white/80 p-3">
          <Label htmlFor="owner-issue-filter" className="text-xs font-semibold text-slate-600">
            특정 사용자 ownerId 필터
          </Label>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input
              id="owner-issue-filter"
              placeholder="예: e3b2c3d4-..."
              value={ownerInput}
              onChange={(event) => setOwnerInput(event.target.value)}
              className="sm:flex-1"
            />
            <div className="flex gap-2">
              <Button type="button" size="sm" onClick={handleApplyOwnerFilter} disabled={inputMatchesFilter}>
                적용
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={handleClearOwnerFilter} disabled={!ownerFilter && ownerInputTrimmed.length === 0}>
                해제
              </Button>
            </div>
          </div>
          <p className="text-[11px] text-slate-500">
            사용자 상세의 “권한 불일치 보기” 버튼으로 이동하면 ownerId가 자동 채워집니다. UUID를 직접 입력해도 됩니다.
          </p>
        </div>
        {ownerFilter ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-emerald-100 bg-emerald-50/80 px-3 py-2 text-xs text-emerald-800">
            <span className="break-all">
              ownerId 필터 적용 중: <code className="font-mono text-[11px]">{ownerFilter}</code>
            </span>
            <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-emerald-800" onClick={handleClearOwnerFilter}>
              필터 해제
            </Button>
          </div>
        ) : null}
        {error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50/80 p-3 text-xs text-rose-700">
            {error.message}
          </div>
        )}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[30%] text-xs font-semibold text-slate-500">이슈</TableHead>
                <TableHead className="w-[30%] text-xs font-semibold text-slate-500">소유자 / 호실</TableHead>
                <TableHead className="w-[25%] text-xs font-semibold text-slate-500">칸 정보</TableHead>
                <TableHead className="text-xs font-semibold text-slate-500">최근 업데이트</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <>
                  {Array.from({ length: 4 }).map((_, index) => (
                    <TableRow key={`issue-skeleton-${index}`}>
                      <TableCell>
                        <Skeleton className="h-5 w-32" />
                        <Skeleton className="mt-2 h-4 w-24" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-5 w-40" />
                        <Skeleton className="mt-2 h-4 w-28" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-5 w-32" />
                        <Skeleton className="mt-2 h-4 w-28" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-5 w-20" />
                      </TableCell>
                    </TableRow>
                  ))}
                </>
              )}
              {!loading && issues.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center text-sm text-slate-500">
                    현재 권한 불일치 항목이 없습니다.
                  </TableCell>
                </TableRow>
              )}
              {!loading && issues.length > 0 && issues.map((issue) => <IssueRow key={issue.bundleId} issue={issue} />)}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}

function AuditLogPreviewTable({ entries }: { entries: AuditLogPreviewEntry[] }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>최근 권한 관련 이벤트 미리보기</span>
        <span>{entries.length}건</span>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs font-semibold text-slate-500">이벤트</TableHead>
              <TableHead className="text-xs font-semibold text-slate-500">대상</TableHead>
              <TableHead className="text-xs font-semibold text-slate-500">수행자</TableHead>
              <TableHead className="text-xs font-semibold text-slate-500">사유</TableHead>
              <TableHead className="text-xs font-semibold text-slate-500">시각</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((entry) => {
              const meta = AUDIT_ACTION_META[entry.actionType] ?? { label: entry.actionType, tone: "slate" as AuditActionTone }
              const badgeClass = AUDIT_TONE_CLASSES[meta.tone]
              const reasonText = entry.reason?.trim() ?? "사유 미입력"
              return (
                <TableRow key={entry.id}>
                  <TableCell className="align-top">
                    <div className="flex flex-col gap-1">
                      <Badge variant="outline" className={`w-fit text-[11px] font-semibold ${badgeClass}`}>
                        {meta.label}
                      </Badge>
                      <p className="text-xs text-slate-500">{entry.actionType}</p>
                    </div>
                  </TableCell>
                  <TableCell className="align-top text-sm text-slate-600">{entry.resource}</TableCell>
                  <TableCell className="align-top text-sm text-slate-600">
                    <span className="font-medium text-slate-900">{entry.actor}</span>
                  </TableCell>
                  <TableCell className="align-top text-sm text-slate-600">{reasonText}</TableCell>
                  <TableCell className="align-top text-xs text-slate-500">{formatAuditTimestamp(entry.occurredAt)}</TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

function IssueRow({ issue }: { issue: FridgeOwnershipIssueItem }) {
  const meta = resolveIssueMeta(issue.issueType)
  const badgeClass = ISSUE_TONE_CLASSES[meta.tone]
  const issueHint = ISSUE_TYPE_HINTS[issue.issueType] ?? ISSUE_TYPE_HINTS.UNKNOWN
  const ownerName = issue.ownerName?.trim() || issue.ownerLoginId || issue.ownerUserId.slice(0, 8)
  const ownerLogin = issue.ownerLoginId ?? issue.ownerUserId
  const roomLabel = formatRoomDisplay(issue)
  const slotLabel = formatSlotDisplay(issue)
  const updatedLabel = formatUpdatedLabel(issue)
  const roomBadgeClass = issue.roomNumber
    ? "border-slate-200 bg-slate-50 text-slate-700"
    : "border-rose-200 bg-rose-50 text-rose-700"

  return (
    <TableRow>
      <TableCell className="align-top">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={`text-[11px] font-medium ${badgeClass}`}>
              {meta.label}
            </Badge>
            <p className="text-sm font-semibold text-slate-900">{issue.bundleName}</p>
          </div>
          <p className="text-xs text-slate-500">라벨 #{issue.labelNumber ?? "-"}</p>
          <p className="text-xs text-slate-500">{issueHint}</p>
        </div>
      </TableCell>
      <TableCell className="align-top">
        <div className="flex flex-col gap-1">
          <p className="text-sm font-semibold text-slate-900">{ownerName}</p>
          <p className="text-xs text-slate-500">{ownerLogin}</p>
          <div className="pt-1">
            <Badge variant="outline" className={`text-[11px] ${roomBadgeClass}`}>
              {roomLabel}
            </Badge>
          </div>
        </div>
      </TableCell>
      <TableCell className="align-top">
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium text-slate-900">{slotLabel}</p>
          <p className="text-xs text-slate-500">
            {issue.fridgeDisplayName?.trim() || issue.fridgeCompartmentId.slice(0, 8)}
          </p>
        </div>
      </TableCell>
      <TableCell className="align-top text-sm text-slate-600">{updatedLabel}</TableCell>
    </TableRow>
  )
}

function resolveIssueMeta(type?: string | null) {
  if (!type) {
    return ISSUE_TYPE_LABELS.UNKNOWN
  }
  return ISSUE_TYPE_LABELS[type] ?? ISSUE_TYPE_LABELS.UNKNOWN
}

function formatRoomDisplay(issue: FridgeOwnershipIssueItem) {
  if (issue.roomNumber) {
    const suffix = typeof issue.personalNo === "number" ? `-${issue.personalNo}` : ""
    return `${issue.roomNumber}${suffix}`
  }
  return "호실 미배정"
}

function formatSlotDisplay(issue: FridgeOwnershipIssueItem) {
  const slotNo = Number.isFinite(issue.slotIndex) ? `슬롯 ${issue.slotIndex + 1}` : null
  const typeLabel =
    issue.compartmentType === "FREEZE" ? "냉동" : issue.compartmentType === "CHILL" ? "냉장" : null
  const floorLabel = typeof issue.fridgeFloorNo === "number" ? `${issue.fridgeFloorNo}F` : null
  const displayName = issue.fridgeDisplayName?.trim()
  return [displayName, floorLabel, slotNo, typeLabel].filter(Boolean).join(" · ") || "칸 정보 없음"
}

function formatUpdatedLabel(issue: FridgeOwnershipIssueItem) {
  const timestamp = issue.updatedAt ?? issue.createdAt
  if (!timestamp) {
    return "시간 정보 없음"
  }
  try {
    const parsed = parseISO(timestamp)
    if (Number.isNaN(parsed.getTime())) {
      return "시간 정보 없음"
    }
    return formatDistanceToNowStrict(parsed, { addSuffix: true })
  } catch {
    return "시간 정보 없음"
  }
}

function formatAuditTimestamp(value: string) {
  if (!value) {
    return "-"
  }
  try {
    const parsed = parseISO(value)
    if (Number.isNaN(parsed.getTime())) {
      return "-"
    }
    return formatDistanceToNowStrict(parsed, { addSuffix: true })
  } catch {
    return "-"
  }
}

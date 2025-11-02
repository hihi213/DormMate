"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { AlertTriangle } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { BulkEditor, DangerZoneModal, DetailsDrawer, FilterBar, PaginatedTable } from "@/components/admin"
import { useAdminUsers } from "@/features/admin/hooks/use-admin-users"
import type { AdminUser } from "@/features/admin/types"

const ROLE_BADGE: Record<AdminUser["role"], string> = {
  RESIDENT: "거주자",
  FLOOR_MANAGER: "층별장",
  ADMIN: "관리자",
}

export default function AdminUsersPage() {
  const { data, loading } = useAdminUsers()
  const userItems = useMemo(() => data?.items ?? [], [data?.items])

  const [filters, setFilters] = useState<Record<string, string>>({
    search: "",
    role: "all",
    status: "ACTIVE",
  })
  const [page, setPage] = useState(1)
  const pageSize = 6
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [drawerUser, setDrawerUser] = useState<AdminUser | null>(null)

  const filtered = useMemo(() => {
    const keyword = filters.search.trim().toLowerCase()
    return userItems.filter((user) => {
      const matchesSearch =
        keyword.length === 0 ||
        user.name.toLowerCase().includes(keyword) ||
        user.room.toLowerCase().includes(keyword)
      const matchesRole = filters.role === "all" ? true : user.role === (filters.role as AdminUser["role"])
      const matchesStatus =
        filters.status === "all" ? true : user.status === (filters.status as AdminUser["status"])
      return matchesSearch && matchesRole && matchesStatus
    })
  }, [filters, userItems])

  const totalItems = filtered.length
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize)

  const toggleSelection = (id: string, checked: boolean) => {
    setSelectedIds((prev) => (checked ? Array.from(new Set([...prev, id])) : prev.filter((value) => value !== id)))
  }

  const resetSelection = () => setSelectedIds([])
  const openDrawer = (user: AdminUser) => setDrawerUser(user)
  const closeDrawer = () => setDrawerUser(null)

  return (
    <>
      <div data-admin-slot="main" className="space-y-6">
        <header className="rounded-3xl border border-emerald-100 bg-white/90 p-6 shadow-sm">
          <div className="flex flex-col gap-2">
            <Badge variant="outline" className="w-fit border-emerald-200 bg-emerald-50 text-emerald-700">
              권한·계정
            </Badge>
            <h1 className="text-2xl font-semibold text-slate-900">층별장 및 관리자 계정 관리</h1>
            <p className="text-sm text-slate-600">
              층별장 승격/복귀, 관리자 임명, 계정 비활성화를 처리합니다. 진행 중 검사 세션이 있는 경우 안전 종료 또는 승계를 안내하세요.
            </p>
          </div>
        </header>

        <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="space-y-4 rounded-3xl border border-slate-200 bg-white/80 p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">필터</h2>
            <FilterBar
              className="flex-col items-stretch gap-3"
              fields={[
                {
                  id: "search",
                  label: "검색",
                  type: "search",
                  placeholder: "이름, 호실 검색",
                },
                {
                  id: "role",
                  label: "역할",
                  type: "segmented",
                  options: [
                    { label: "전체", value: "all" },
                    { label: "거주자", value: "RESIDENT" },
                    { label: "층별장", value: "FLOOR_MANAGER" },
                    { label: "관리자", value: "ADMIN" },
                  ],
                },
                {
                  id: "status",
                  label: "상태",
                  type: "select",
                  options: [
                    { label: "활성", value: "ACTIVE" },
                    { label: "비활성", value: "INACTIVE" },
                    { label: "전체", value: "all" },
                  ],
                },
              ]}
              values={filters}
              onChange={(id, value) => {
                setFilters((prev) => ({ ...prev, [id]: value }))
                setPage(1)
              }}
            />
            <Separator />
            <div className="space-y-3 text-xs text-slate-600">
              <p className="font-semibold text-slate-900">운영 안내</p>
              <p>층별장 임명/해제는 진행 중 검사 세션이 없는지 확인 후 진행하세요.</p>
              <p>계정 비활성화 시 DormMate 접근이 차단되며, 예약/검사 세션이 모두 정리됩니다.</p>
              <Button asChild variant="link" size="sm" className="px-0 text-emerald-600">
                <Link href="/admin/audit?module=roles">권한 변경 감사 로그</Link>
              </Button>
            </div>
          </aside>

          <section className="space-y-4">
            <Card className="shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-semibold text-slate-900">사용자 목록</CardTitle>
                <span className="text-xs text-slate-500">{loading ? "불러오는 중" : `총 ${totalItems}명`}</span>
              </CardHeader>
              <CardContent>
                <PaginatedTable
                  columns={[
                    {
                      key: "select",
                      header: "",
                      width: "40px",
                      render: (row) => (
                        <Checkbox
                          aria-label={`${row.name} 선택`}
                          checked={selectedIds.includes(row.id)}
                          onCheckedChange={(checked) => toggleSelection(row.id, Boolean(checked))}
                        />
                      ),
                    },
                    {
                      key: "name",
                      header: "사용자",
                      render: (row) => (
                        <div className="flex flex-col">
                          <span className="font-medium text-slate-900">{row.name}</span>
                          <span className="text-xs text-muted-foreground">{row.room}</span>
                        </div>
                      ),
                    },
                    {
                      key: "role",
                      header: "역할",
                      render: (row) => <Badge variant="outline">{ROLE_BADGE[row.role]}</Badge>,
                    },
                    {
                      key: "status",
                      header: "상태",
                      render: (row) => (
                        <Badge
                          variant="outline"
                          className={row.status === "ACTIVE" ? "border-emerald-200 text-emerald-700" : "border-slate-200 text-slate-500"}
                        >
                          {row.status}
                        </Badge>
                      ),
                    },
                    {
                      key: "lastLogin",
                      header: "최근 로그인",
                    },
                    {
                      key: "actions",
                      header: "",
                      render: (row) => (
                        <Button type="button" size="sm" variant="ghost" onClick={() => openDrawer(row)}>
                          상세
                        </Button>
                      ),
                    },
                  ]}
                  data={paginated}
                  pagination={{
                    page,
                    pageSize,
                    totalItems,
                    onPageChange: setPage,
                  }}
                  getRowId={(row) => row.id}
                />
                {loading && paginated.length === 0 ? (
                  <p className="mt-4 text-xs text-muted-foreground">사용자 데이터를 불러오는 중입니다…</p>
                ) : null}
              </CardContent>
            </Card>

            <BulkEditor
              selectedCount={selectedIds.length}
              onClearSelection={resetSelection}
              secondaryActions={[
                {
                  id: "demote",
                  label: "층별장 해제",
                  variant: "outline",
                  onSelect: () => {
                    const target = userItems.find((user) => selectedIds.includes(user.id))
                    if (target) openDrawer(target)
                  },
                },
              ]}
              primaryAction={{
                id: "promote",
                label: "층별장 임명",
                onSelect: () => {
                  const target = userItems.find((user) => selectedIds.includes(user.id))
                  if (target) openDrawer(target)
                },
              }}
            >
              <span className="text-xs text-muted-foreground">층별장 변경 시 진행 중 검사 세션 승계/종료 절차를 확인하세요.</span>
            </BulkEditor>
          </section>
        </div>

        <DetailsDrawer
          title={drawerUser?.name ?? ""}
          description={drawerUser ? `${drawerUser.room} · 최근 로그인 ${drawerUser.lastLogin}` : ""}
          open={Boolean(drawerUser)}
          onOpenChange={(open) => {
            if (!open) closeDrawer()
          }}
        >
          {drawerUser ? (
            <div className="space-y-4 text-sm">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label className="text-xs text-muted-foreground">현재 역할</Label>
                  <p className="font-medium text-slate-900">{ROLE_BADGE[drawerUser.role]}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">계정 상태</Label>
                  <p className="font-medium text-slate-900">{drawerUser.status}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">진행 중 검사</Label>
                  <p className="font-medium text-slate-900">{drawerUser.inspectionsInProgress ?? 0}건</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">누적 벌점</Label>
                  <p className="font-medium text-slate-900">{drawerUser.penalties ?? 0}점</p>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">역할 변경</Label>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm">
                    층별장 임명
                  </Button>
                  <Button type="button" variant="ghost" size="sm">
                    일반 거주자 전환
                  </Button>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">위험 작업</Label>
                <DangerZoneModal
                  title="계정을 비활성화하시겠습니까?"
                  description="비활성화 시 DormMate 접근이 차단되며, 관련 예약/검사 세션이 모두 정리됩니다."
                  confirmLabel="비활성화"
                  onConfirm={async () => {
                    closeDrawer()
                  }}
                />
              </div>
            </div>
          ) : null}
        </DetailsDrawer>

        <section id="penalty-summary" className="space-y-4">
          <Card className="rounded-3xl border border-slate-200 bg-white/90 shadow-sm">
            <CardHeader className="flex flex-row items-center gap-3 border-b border-slate-200 pb-4">
              <span className="rounded-full bg-rose-100 p-2">
                <AlertTriangle className="size-4 text-rose-700" aria-hidden />
              </span>
              <div>
                <CardTitle className="text-base font-semibold">벌점 현황 &amp; 임계치 모니터링</CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  폐기 조치 및 타 모듈 벌점을 집계해 임계치(10점)를 초과한 사용자를 확인합니다. 상세 기능은 Post-MVP에서 확장됩니다.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-600">
              <p>현재 벌점 데이터 API 연동 준비 중입니다. Post-MVP에서 도입될 예정이며, 임시로 관리자 대시보드 요약만 제공합니다.</p>
              <p>
                누적 벌점이 임계치를 초과하면 알림 정책에서 정의한 템플릿으로 자동 발송되며, 제재 해제/이의신청은 감사 로그와 연결됩니다.
              </p>
              <Separator />
              <p className="text-xs text-slate-500">향후 확장: 벌점 타임라인, 제재 이력, 이의신청 워크플로우.</p>
            </CardContent>
          </Card>
        </section>
      </div>

      <div data-admin-slot="rail" className="space-y-4 text-sm">
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-slate-800">신속 링크</h2>
          <div className="space-y-2">
            <QuickLink href="/admin/audit?module=roles" label="권한 변경 감사 로그" />
            <QuickLink href="/admin/notifications" label="층별장 임명 알림 템플릿" />
            <QuickLink href="#penalty-summary" label="벌점 현황" />
          </div>
        </section>
        <Separator />
        <section className="space-y-2 text-xs text-slate-600">
          <h3 className="text-sm font-semibold text-slate-800">운영 메모</h3>
          <p>권한 변경 시 감사 로그에 사유를 남기고, 층별 공지를 통해 즉시 공유하세요.</p>
          <p>계정 비활성화는 DormMate 전체 접근에 영향이 있으므로 반드시 관리자 두 명 이상이 교차 확인합니다.</p>
        </section>
      </div>
    </>
  )
}

function QuickLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="block rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-xs text-slate-600 transition hover:border-emerald-200 hover:text-emerald-700"
    >
      <span className="text-sm font-semibold text-slate-900">{label}</span>
    </Link>
  )
}

"use client"

import { useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { BulkEditor, DangerZoneModal, DetailsDrawer, FilterBar, PaginatedTable } from "@/components/admin"
import { useAdminUsers } from "@/features/admin/hooks/use-admin-users"
import type { AdminUser } from "@/features/admin/types"

type Role = AdminUser["role"]

type UserRow = AdminUser

export default function AdminRolesPage() {
  const [filters, setFilters] = useState<Record<string, string>>({
    search: "",
    role: "all",
    status: "ACTIVE",
  })
  const [page, setPage] = useState(1)
  const pageSize = 5
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [drawerUser, setDrawerUser] = useState<UserRow | null>(null)
  const { data, loading } = useAdminUsers()

  const userItems = useMemo(() => data?.items ?? [], [data?.items])

  const filtered = useMemo(() => {
    const keyword = filters.search.trim().toLowerCase()
    return userItems.filter((user) => {
      const matchesSearch =
        keyword.length === 0 ||
        user.name.toLowerCase().includes(keyword) ||
        user.room.toLowerCase().includes(keyword)
      const matchesRole = filters.role === "all" ? true : user.role === (filters.role as Role)
      const matchesStatus =
        filters.status === "all" ? true : user.status === (filters.status as UserRow["status"])
      return matchesSearch && matchesRole && matchesStatus
    })
  }, [filters, userItems])

  const totalItems = filtered.length
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize)

  const toggleSelection = (id: string, checked: boolean) => {
    setSelectedIds((prev) => (checked ? Array.from(new Set([...prev, id])) : prev.filter((value) => value !== id)))
  }

  const resetSelection = () => setSelectedIds([])

  const openDrawer = (user: UserRow) => setDrawerUser(user)
  const closeDrawer = () => setDrawerUser(null)

  const getRoleBadge = (role: Role) => {
    switch (role) {
      case "FLOOR_MANAGER":
        return "층별장"
      case "ADMIN":
        return "관리자"
      default:
        return "거주자"
    }
  }

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-xl font-semibold text-slate-800">권한·계정</h1>
        <p className="text-sm text-muted-foreground">
          층별장 승격/복귀, 관리자 임명, 계정 비활성화를 처리합니다. 진행 중 검사 세션이 있을 경우 안전 종료 또는 승계를 안내합니다.
        </p>
      </header>

      <FilterBar
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

      <Card className="shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-slate-800">사용자 목록</CardTitle>
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
                render: (row) => <Badge variant="outline">{getRoleBadge(row.role)}</Badge>,
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
                <p className="font-medium text-slate-900">{getRoleBadge(drawerUser.role)}</p>
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
    </section>
  )
}

"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { AlertTriangle } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { BulkEditor, DangerZoneModal, DetailsDrawer, PaginatedTable } from "@/components/admin"
import {
  demoteAdminFloorManager,
  deactivateAdminUser,
  promoteAdminFloorManager,
} from "@/features/admin/api"
import { useAdminUsers } from "@/features/admin/hooks/use-admin-users"
import type { AdminUser } from "@/features/admin/types"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"

type UserStatusFilter = "ACTIVE" | "INACTIVE"

type FilterState = {
  search: string
  floor: string
  status: UserStatusFilter
}

type SelectionMode = "PROMOTE" | "DEACTIVATE" | null

export default function AdminUsersPage() {
  const [filters, setFilters] = useState<FilterState>({
    search: "",
    floor: "ALL",
    status: "ACTIVE",
  })
  const { data, loading, error, refetch } = useAdminUsers(filters.status)
  const userItems = useMemo(() => data?.items ?? [], [data?.items])
  const [page, setPage] = useState(1)
  const pageSize = 6
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [drawerUser, setDrawerUser] = useState<AdminUser | null>(null)
  const [searchInput, setSearchInput] = useState("")
  const [selectionMode, setSelectionMode] = useState<SelectionMode>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    setSearchInput(filters.search)
  }, [filters.search])

  useEffect(() => {
    setSelectedIds([])
    setDrawerUser(null)
  }, [filters.status])

  const floors = useMemo(() => {
    const set = new Set<number>()
    userItems.forEach((user) => {
      const floor = resolveUserFloor(user)
      if (floor !== null) set.add(floor)
    })
    return Array.from(set).sort((a, b) => a - b)
  }, [userItems])

  const filteredUsers = useMemo(() => {
    const keyword = filters.search.trim().toLowerCase()
    return userItems.filter((user) => {
      const roomLabel = user.room?.toLowerCase() ?? ""
      const roomCode = user.roomCode?.toLowerCase() ?? ""
      const personalNo = user.personalNo != null ? String(user.personalNo) : ""
      const roomWithPersonal = formatRoomWithPersonal(user).toLowerCase()
      const matchesSearch =
        keyword.length === 0 ||
        user.name.toLowerCase().includes(keyword) ||
        roomLabel.includes(keyword) ||
        roomCode.includes(keyword) ||
        roomWithPersonal.includes(keyword) ||
        personalNo.includes(keyword) ||
        user.id.toLowerCase().includes(keyword)

      const statusMatches = user.status === filters.status
      const userFloor = resolveUserFloor(user)
      const floorMatches =
        filters.floor === "ALL" || (userFloor !== null && String(userFloor) === filters.floor)

      return matchesSearch && statusMatches && floorMatches
    })
  }, [filters, userItems])

  const totalItems = filteredUsers.length
  const paginated = filteredUsers.slice((page - 1) * pageSize, page * pageSize)

  const isSelectionEnabled = selectionMode !== null

  const toggleSelection = (id: string, checked: boolean) => {
    if (!isSelectionEnabled || actionLoading) return
    setSelectedIds((prev) => (checked ? Array.from(new Set([...prev, id])) : prev.filter((value) => value !== id)))
  }

  const resetSelection = () => setSelectedIds([])
  const openDrawer = (user: AdminUser) => setDrawerUser(user)
  const closeDrawer = () => setDrawerUser(null)

  const handleSearchSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFilters((prev) => ({ ...prev, search: searchInput.trim() }))
    setPage(1)
  }

  const handleFloorChange = (value: string) => {
    setFilters((prev) => ({ ...prev, floor: value }))
    setPage(1)
  }

  const handleStatusChange = (status: UserStatusFilter) => {
    setFilters((prev) => ({ ...prev, status }))
    setPage(1)
  }

  const startSelection = (mode: Exclude<SelectionMode, null>) => {
    if (actionLoading) return
    if (selectionMode === mode) {
      cancelSelection()
      return
    }
    setSelectionMode(mode)
    resetSelection()
  }

  const cancelSelection = () => {
    setSelectionMode(null)
    resetSelection()
  }

  const handleRowClick = (user: AdminUser) => {
    if (actionLoading) return
    if (selectionMode) {
      const nextChecked = !selectedIds.includes(user.id)
      toggleSelection(user.id, nextChecked)
      return
    }
    openDrawer(user)
  }

  const confirmSelection = async () => {
    if (!selectionMode || selectedIds.length === 0) return
    setActionLoading(true)
    const actionLabel = selectionMode === "PROMOTE" ? "층별장 임명" : "계정 비활성화"
    try {
      if (selectionMode === "PROMOTE") {
        await Promise.all(selectedIds.map((id) => promoteAdminFloorManager(id)))
      } else {
        await Promise.all(selectedIds.map((id) => deactivateAdminUser(id)))
      }
      toast({
        title: `${actionLabel} 완료`,
        description: `${selectedIds.length}명의 사용자에 대해 ${actionLabel}이 반영되었습니다.`,
      })
      await refetch()
      setPage(1)
      cancelSelection()
    } catch (err) {
      toast({
        title: `${actionLabel} 실패`,
        description: err instanceof Error ? err.message : "잠시 후 다시 시도해주세요.",
        variant: "destructive",
      })
    } finally {
      setActionLoading(false)
    }
  }

  const handlePromoteUser = async (user: AdminUser) => {
    setActionLoading(true)
    try {
      await promoteAdminFloorManager(user.id)
      toast({
        title: "층별장 임명 완료",
        description: `${user.name}님이 층별장으로 임명되었습니다.`,
      })
      await refetch()
      closeDrawer()
    } catch (err) {
      toast({
        title: "층별장 임명 실패",
        description: err instanceof Error ? err.message : "잠시 후 다시 시도해주세요.",
        variant: "destructive",
      })
    } finally {
      setActionLoading(false)
    }
  }

  const handleDemoteUser = async (user: AdminUser) => {
    setActionLoading(true)
    try {
      await demoteAdminFloorManager(user.id)
      toast({
        title: "층별장 해제 완료",
        description: `${user.name}님의 층별장 권한을 해제했습니다.`,
      })
      await refetch()
      closeDrawer()
    } catch (err) {
      toast({
        title: "층별장 해제 실패",
        description: err instanceof Error ? err.message : "잠시 후 다시 시도해주세요.",
        variant: "destructive",
      })
    } finally {
      setActionLoading(false)
    }
  }

  const handleDeactivateUser = async (user: AdminUser) => {
    setActionLoading(true)
    try {
      await deactivateAdminUser(user.id)
      toast({
        title: "계정 비활성화 완료",
        description: `${user.name}님의 DormMate 접근이 중단되었습니다.`,
      })
      await refetch()
      closeDrawer()
    } catch (err) {
      toast({
        title: "계정 비활성화 실패",
        description: err instanceof Error ? err.message : "잠시 후 다시 시도해주세요.",
        variant: "destructive",
      })
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <>
      <div data-admin-slot="main" className="space-y-6">
        <section className="rounded-3xl border border-emerald-100 bg-white/90 p-6 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2">
              <Badge variant="outline" className="w-fit border-emerald-200 bg-emerald-50 text-emerald-700">
                권한·계정
              </Badge>
              <h1 className="text-2xl font-semibold text-slate-900">층별장 및 관리자 계정 관리</h1>
              <p className="text-sm text-slate-600">
                층별장 승격/복귀, 관리자 임명, 계정 비활성화를 처리합니다. 진행 중 검사 세션이 있는 경우 승계·종료 절차를
                먼저 확인하세요.
              </p>
            </div>
            <Badge variant="secondary" className="h-fit rounded-full bg-emerald-100 px-4 py-1 text-sm font-medium text-emerald-700">
              총 {totalItems.toLocaleString()}명
            </Badge>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-sm space-y-4">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,0.6fr)_minmax(0,1fr)_auto]">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wide text-slate-600">층 선택</Label>
              <Select value={filters.floor} onValueChange={handleFloorChange}>
                <SelectTrigger className="h-10 rounded-xl border border-slate-200 bg-white/90">
                  <SelectValue placeholder="층 선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">전체</SelectItem>
                  {floors.map((floor) => (
                    <SelectItem key={floor} value={String(floor)}>
                      {floor}층
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <form onSubmit={handleSearchSubmit} className="grid w-full grid-cols-[minmax(0,1fr)_auto] gap-2 lg:w-auto">
              <div className="space-y-1.5">
                <Label htmlFor="user-search" className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                  검색
                </Label>
                <Input
                  id="user-search"
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder="이름·호실(예: 301-1)·개인번호 검색"
                  className="h-10 rounded-xl border border-slate-200 bg-white/90"
                />
              </div>
              <div className="flex items-end">
                <Button type="submit" className="h-10 px-4">
                  검색
                </Button>
              </div>
            </form>
            <div className="flex items-end justify-end">
              <Button asChild variant="ghost" className="text-slate-600">
                <Link href="/admin/audit?module=roles">권한 변경 로그</Link>
              </Button>
            </div>
          </div>
          <Separator />
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2 text-xs text-slate-600">
              <span className="text-sm font-semibold text-slate-800">
                사용자 목록 · 총 {totalItems.toLocaleString()}명
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">상태</span>
                <div className="flex gap-1 rounded-full border border-slate-200 bg-slate-50/80 p-1">
                  {(["ACTIVE", "INACTIVE"] as UserStatusFilter[]).map((status) => {
                    const isActive = filters.status === status
                    return (
                      <Button
                        key={status}
                        type="button"
                        size="sm"
                        variant={isActive ? "default" : "ghost"}
                        className={cn(
                          "px-3 text-xs font-medium",
                          isActive
                            ? "bg-emerald-200/80 text-emerald-800 hover:bg-emerald-200/80"
                            : "text-slate-600 hover:text-emerald-600",
                        )}
                        onClick={() => handleStatusChange(status)}
                      >
                        {status === "ACTIVE" ? "활성" : "비활성"}
                      </Button>
                    )
                  })}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant={selectionMode === "PROMOTE" ? "default" : "outline"}
                disabled={actionLoading}
                onClick={() => startSelection("PROMOTE")}
              >
                {selectionMode === "PROMOTE" ? "선택 취소" : "층별장 임명"}
              </Button>
              <Button
                type="button"
                variant={selectionMode === "DEACTIVATE" ? "default" : "outline"}
                disabled={actionLoading}
                onClick={() => startSelection("DEACTIVATE")}
              >
                {selectionMode === "DEACTIVATE" ? "선택 취소" : "비활성화"}
              </Button>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          {error ? (
            <Alert variant="destructive">
              <AlertTriangle aria-hidden className="text-rose-600" />
              <AlertTitle>사용자 목록을 불러오지 못했습니다</AlertTitle>
              <AlertDescription>
                <p>네트워크 또는 서버 상태를 확인한 뒤 다시 시도하세요.</p>
                <Button size="sm" variant="outline" className="mt-2" onClick={refetch}>
                  다시 시도
                </Button>
              </AlertDescription>
            </Alert>
          ) : null}
          <Card className="shadow-sm">
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
                        disabled={!isSelectionEnabled || actionLoading}
                        onClick={(event) => event.stopPropagation()}
                      />
                    ),
                  },
                  {
                    key: "room",
                    header: "호실",
                    render: (row) => {
                      const code = resolveRoomCode(row)
                      return code ? (
                        <span className="font-medium text-slate-800">{code}</span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )
                    },
                  },
                  {
                    key: "personal",
                    header: "개인번호",
                    render: (row) =>
                      row.personalNo != null ? (
                        <Badge variant="outline" className="border-slate-200 bg-slate-50 px-2 font-semibold text-slate-700">
                          {row.personalNo}
                        </Badge>
                      ) : (
                        <span className="text-slate-400">-</span>
                      ),
                  },
                  {
                    key: "name",
                    header: "사용자",
                    render: (row) => (
                      <div className="flex flex-col">
                        <span className="font-medium text-slate-900">{row.name}</span>
                        <span className="text-xs text-muted-foreground">{formatRoomWithPersonal(row)}</span>
                      </div>
                    ),
                  },
                  {
                    key: "extra",
                    header: "추가 권한",
                    render: (row) =>
                      row.role === "FLOOR_MANAGER" ? (
                        <Badge variant="outline" className="border-emerald-200 text-emerald-700">
                          층별장
                        </Badge>
                      ) : (
                        <span className="text-slate-400">-</span>
                      ),
                  },
                  {
                    key: "penalties",
                    header: "벌점",
                    render: (row) => (
                      <span
                        className={
                          row.penalties && row.penalties > 0 ? "font-medium text-rose-600" : "text-slate-600"
                        }
                      >
                        {(row.penalties ?? 0).toLocaleString()}점
                      </span>
                    ),
                  },
                  {
                    key: "lastLogin",
                    header: "최근 로그인",
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
                ]}
                data={paginated}
                onRowClick={(row) => handleRowClick(row)}
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

          {selectionMode ? (
            <BulkEditor
              selectedCount={selectedIds.length}
              onClearSelection={resetSelection}
              secondaryActions={[
                {
                  id: "cancel",
                  label: "선택 취소",
                  variant: "ghost",
                  onSelect: cancelSelection,
                  disabled: actionLoading,
                },
              ]}
              primaryAction={{
                id: "confirm",
                label: selectionMode === "PROMOTE" ? "임명 확정" : "비활성화 확정",
                onSelect: () => {
                  void confirmSelection()
                },
                disabled: actionLoading || selectedIds.length === 0,
              }}
            >
              <span className="text-xs text-muted-foreground">
                선택한 사용자 {selectedIds.length}명 · {selectionMode === "PROMOTE" ? "층별장 임명" : "계정 비활성화"}을 진행하려면 확정
                버튼을 누르세요.
              </span>
            </BulkEditor>
          ) : null}
        </section>

        <DetailsDrawer
          title={drawerUser?.name ?? ""}
          description={
            drawerUser
              ? `${formatRoomWithPersonal(drawerUser)} · 최근 로그인 ${drawerUser.lastLogin}`
              : ""
          }
          open={Boolean(drawerUser)}
          onOpenChange={(open) => {
            if (!open) closeDrawer()
          }}
        >
          {drawerUser ? (
            <div className="space-y-4 text-sm">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label className="text-xs text-muted-foreground">기본 역할</Label>
                  <p className="font-medium text-slate-900">{drawerUser.role === "ADMIN" ? "관리자" : "거주자"}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">호실·개인번호</Label>
                  <p className="font-medium text-slate-900">{formatRoomWithPersonal(drawerUser)}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">추가 권한</Label>
                  <p className="font-medium text-slate-900">{drawerUser.role === "FLOOR_MANAGER" ? "층별장" : "-"}</p>
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
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={actionLoading || drawerUser?.role === "FLOOR_MANAGER"}
                    onClick={() => drawerUser && void handlePromoteUser(drawerUser)}
                  >
                    층별장 임명
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={actionLoading || drawerUser?.role !== "FLOOR_MANAGER"}
                    onClick={() => drawerUser && void handleDemoteUser(drawerUser)}
                  >
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
                    if (!drawerUser) return
                    await handleDeactivateUser(drawerUser)
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

function resolveUserFloor(user: AdminUser): number | null {
  if (typeof user.floor === "number") {
    return Number.isNaN(user.floor) ? null : user.floor
  }
  if (user.room) {
    const match = user.room.match(/(\d+)F/i)
    if (match) {
      const parsed = Number.parseInt(match[1], 10)
      return Number.isNaN(parsed) ? null : parsed
    }
  }
  return null
}

function resolveRoomCode(user: AdminUser): string | null {
  if (user.roomCode) return user.roomCode
  if (user.room) {
    const match = user.room.match(/(\d+)F\s*(\d{1,2})/i)
    if (match) {
      const floor = match[1]
      const room = match[2].padStart(2, "0")
      return `${floor}${room}`
    }
  }
  return null
}

function formatRoomWithPersonal(user: AdminUser): string {
  const roomCode = resolveRoomCode(user)
  if (roomCode && user.personalNo != null) {
    return `${roomCode}-${user.personalNo}`
  }
  if (roomCode) return roomCode
  return user.room ?? "호실 미배정"
}

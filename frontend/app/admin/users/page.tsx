"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { AlertTriangle } from "lucide-react"
import { format } from "date-fns"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { BulkEditor, DangerZoneModal, DetailsDrawer } from "@/components/admin"
import {
  demoteAdminFloorManager,
  deactivateAdminUser,
  promoteAdminFloorManager,
  fetchAdminUsers,
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
type RoleChangeMode = "PROMOTE" | "DEMOTE"

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
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pendingFocusId, setPendingFocusId] = useState<string | null>(null)
  const processedFocusIdRef = useRef<string | null>(null)
  const [focusCandidate, setFocusCandidate] = useState<AdminUser | null>(null)
  const [focusLookupLoading, setFocusLookupLoading] = useState(false)
  const [focusLookupAttempted, setFocusLookupAttempted] = useState(false)
  const [focusedUserId, setFocusedUserId] = useState<string | null>(null)
  const [roleDialogOpen, setRoleDialogOpen] = useState(false)
  const [roleChangeMode, setRoleChangeMode] = useState<RoleChangeMode>("PROMOTE")
  const [roleChangeReason, setRoleChangeReason] = useState("")
  const focusParam = searchParams.get("focus")

  const primaryRoleLabel = drawerUser
    ? drawerUser.role === "ADMIN"
      ? "관리자"
      : "거주자"
    : undefined
  const extraRoleLabel =
    drawerUser?.role === "FLOOR_MANAGER" ? "층별장" : drawerUser?.role === "ADMIN" ? "관리자" : "-"
  const canPromoteCurrent = drawerUser != null && drawerUser.role !== "FLOOR_MANAGER"
  const canDemoteCurrent = drawerUser?.role === "FLOOR_MANAGER"
  const trimmedRoleChangeReason = roleChangeReason.trim()
  const canSubmitRoleChange =
    !!drawerUser &&
    (roleChangeMode === "PROMOTE" ? canPromoteCurrent : canDemoteCurrent) &&
    trimmedRoleChangeReason.length >= 2 &&
    !actionLoading

  useEffect(() => {
    if (focusParam) {
      if (processedFocusIdRef.current !== focusParam) {
        setPendingFocusId(focusParam)
        setFocusCandidate(null)
        setFocusLookupAttempted(false)
        setFocusLookupLoading(false)
      }
    } else {
      processedFocusIdRef.current = null
      setPendingFocusId(null)
      setFocusCandidate(null)
      setFocusLookupAttempted(false)
      setFocusLookupLoading(false)
    }
  }, [focusParam])

  useEffect(() => {
    if (!pendingFocusId) return
    const current = userItems.find((user) => user.id === pendingFocusId)
    if (current) {
      setFocusCandidate(current)
      return
    }
    if (focusLookupAttempted || focusLookupLoading) return
    let cancelled = false
    const lookup = async () => {
      try {
        setFocusLookupLoading(true)
        setFocusLookupAttempted(true)
        const response = await fetchAdminUsers("ALL")
        if (cancelled) return
        const found = response.items.find((user) => user.id === pendingFocusId)
        if (found) {
          setFocusCandidate(found)
        } else {
          toast({
            title: "사용자를 찾을 수 없습니다.",
            description: "링크가 만료되었거나 삭제된 사용자입니다.",
            variant: "destructive",
          })
          processedFocusIdRef.current = pendingFocusId
          setPendingFocusId(null)
        }
      } catch (err) {
        if (cancelled) return
        toast({
          title: "사용자 정보를 불러오지 못했습니다.",
          description: err instanceof Error ? err.message : "잠시 후 다시 시도해주세요.",
          variant: "destructive",
        })
        processedFocusIdRef.current = pendingFocusId
        setPendingFocusId(null)
      } finally {
        if (!cancelled) {
          setFocusLookupLoading(false)
        }
      }
    }
    void lookup()
    return () => {
      cancelled = true
    }
  }, [pendingFocusId, userItems, focusLookupAttempted, focusLookupLoading, toast])

  useEffect(() => {
    setSearchInput(filters.search)
  }, [filters.search])

  useEffect(() => {
    setSelectedIds([])
    setDrawerUser(null)
  }, [filters.status])

  useEffect(() => {
    if (!drawerUser) {
      setRoleDialogOpen(false)
      setRoleChangeReason("")
      return
    }
    setRoleChangeMode(drawerUser.role === "FLOOR_MANAGER" ? "DEMOTE" : "PROMOTE")
  }, [drawerUser])

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
    const filtered = userItems.filter((user) => {
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
    return filtered.sort(compareAdminUsers)
  }, [filters, userItems])

  const totalItems = filteredUsers.length
  const paginated = filteredUsers.slice((page - 1) * pageSize, page * pageSize)
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))

  useEffect(() => {
    if (!pendingFocusId || !focusCandidate) return

    const candidateStatus = focusCandidate.status as UserStatusFilter
    if (filters.status !== candidateStatus) {
      setFilters((prev) => ({ ...prev, status: candidateStatus }))
      setPage(1)
      return
    }
    if (filters.floor !== "ALL") {
      setFilters((prev) => ({ ...prev, floor: "ALL" }))
      return
    }
    if (filters.search !== "") {
      setFilters((prev) => ({ ...prev, search: "" }))
      setSearchInput("")
      return
    }

    const targetIndex = filteredUsers.findIndex((user) => user.id === focusCandidate.id)
    if (targetIndex === -1) {
      return
    }
    const targetPage = Math.floor(targetIndex / pageSize) + 1
    if (page !== targetPage) {
      setPage(targetPage)
      return
    }

    setDrawerUser(focusCandidate)
    setFocusedUserId(focusCandidate.id)
    processedFocusIdRef.current = focusCandidate.id
    setPendingFocusId(null)

    const params = new URLSearchParams(searchParams.toString())
    params.delete("focus")
    const next = params.toString()
    router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false })
  }, [
    pendingFocusId,
    focusCandidate,
    filters.status,
    filters.floor,
    filters.search,
    filteredUsers,
    page,
    pageSize,
    setFilters,
    pathname,
    router,
    searchParams,
  ])

  const isSelectionEnabled = selectionMode !== null

  const toggleSelection = (id: string, checked: boolean) => {
    if (!isSelectionEnabled || actionLoading) return
    setSelectedIds((prev) => (checked ? Array.from(new Set([...prev, id])) : prev.filter((value) => value !== id)))
  }

  const resetSelection = () => setSelectedIds([])
  const openDrawer = (user: AdminUser) => {
    if (typeof document !== "undefined") {
      const activeElement = document.activeElement as HTMLElement | null
      activeElement?.blur()
    }
    setDrawerUser(user)
    setFocusedUserId(user.id)
  }
  const closeDrawer = () => {
    setDrawerUser(null)
    setFocusedUserId(null)
  }

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
    setFocusedUserId(null)
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

  const handlePromoteUser = async (user: AdminUser, reason?: string) => {
    setActionLoading(true)
    try {
      await promoteAdminFloorManager(user.id)
      toast({
        title: "층별장 임명 완료",
        description: `${user.name}님이 층별장으로 임명되었습니다.${reason ? ` 사유: ${reason}` : ""}`,
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

  const handleDemoteUser = async (user: AdminUser, reason?: string) => {
    setActionLoading(true)
    try {
      await demoteAdminFloorManager(user.id)
      toast({
        title: "층별장 해제 완료",
        description: `${user.name}님의 층별장 권한을 해제했습니다.${reason ? ` 사유: ${reason}` : ""}`,
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

  const handleRoleChangeConfirm = () => {
    if (!drawerUser) return
    const trimmed = roleChangeReason.trim()
    if (roleChangeMode === "PROMOTE" && !canPromoteCurrent) return
    if (roleChangeMode === "DEMOTE" && !canDemoteCurrent) return
    setRoleDialogOpen(false)
    setRoleChangeReason("")
    if (roleChangeMode === "PROMOTE") {
      void handlePromoteUser(drawerUser, trimmed)
    } else {
      void handleDemoteUser(drawerUser, trimmed)
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

  const handleAdjustPenalty = async (user: AdminUser) => {
    toast({
      title: "벌점 조정 준비 중",
      description: "벌점 차감/삭제 기능은 벌점 허브 확장 시 연동될 예정입니다.",
    })
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
                층별장 승격/복귀, 관리자 임명, 계정 비활성화를 처리합니다. 변경 이력은 감사 로그에서 추적하세요.
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
            <CardContent className="space-y-3">
              {paginated.length === 0 && !loading ? (
                <p className="text-center text-xs text-muted-foreground">표시할 사용자가 없습니다.</p>
              ) : (
                paginated.map((user) => {
                  const penaltiesLabel = `${(user.penalties ?? 0).toLocaleString()}점`
                  const isFocused = focusedUserId === user.id
                  const isSelected = selectedIds.includes(user.id)
                  return (
                    <div
                      key={user.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => handleRowClick(user)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault()
                          handleRowClick(user)
                        }
                      }}
                      className={cn(
                        "rounded-2xl border border-slate-200 bg-white/95 p-4 text-sm shadow-sm transition hover:border-emerald-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500",
                        isFocused && "ring-2 ring-emerald-200",
                      )}
                    >
                      <div className="flex flex-col gap-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            {selectionMode ? (
                              <Checkbox
                                aria-label={`${user.name} 선택`}
                                checked={isSelected}
                                disabled={actionLoading}
                                onCheckedChange={(checked) => toggleSelection(user.id, Boolean(checked))}
                                onClick={(event) => event.stopPropagation()}
                              />
                            ) : null}
                            <span
                              className={cn(
                                "inline-flex min-w-[52px] items-center justify-center rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
                                user.role === "FLOOR_MANAGER"
                                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                  : "border-slate-200 bg-slate-50 text-slate-500",
                              )}
                            >
                              {user.role === "FLOOR_MANAGER" ? "층별장" : "일반"}
                            </span>
                            <p className="text-lg font-semibold text-slate-900">{user.name}</p>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 sm:text-sm">
                          <div className="flex flex-wrap items-baseline gap-4 font-medium text-slate-700">
                            <span>
                              <span className="mr-1 text-[11px] uppercase tracking-wide text-slate-400">호실</span>
                              {resolveRoomCode(user) ?? "-"}
                            </span>
                            <span>
                              <span className="mr-1 text-[11px] uppercase tracking-wide text-slate-400">번호</span>
                              {user.personalNo != null ? `${user.personalNo}` : "-"}
                            </span>
                            <span>
                              <span className="mr-1 text-[11px] uppercase tracking-wide text-slate-400">벌점</span>
                              {penaltiesLabel}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-slate-600 sm:text-sm">
                            <span>
                              <span className="mr-1 text-[11px] uppercase tracking-wide text-slate-400">상태</span>
                              {user.status === "ACTIVE" ? "활성" : "비활성"}
                            </span>
                            <span className="inline-flex min-w-[140px] justify-between text-[12px] text-slate-500">
                              <span className="text-[11px] uppercase tracking-wide text-slate-400">최근 로그인</span>
                              <span className="font-semibold text-slate-700">{formatLastLogin(user.lastLogin)}</span>
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
              {totalPages > 1 ? (
                <div className="flex items-center justify-center gap-3 pt-2 sm:justify-end">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                    disabled={page <= 1}
                  >
                    이전
                  </Button>
                  <span className="text-xs font-medium text-slate-500">
                    {page} / {totalPages}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                    disabled={page >= totalPages}
                  >
                    다음
                  </Button>
                </div>
              ) : null}
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
          title=""
          open={Boolean(drawerUser)}
          direction="right"
          onOpenChange={(open) => {
            if (!open) closeDrawer()
          }}
        >
          {drawerUser ? (
            <div className="space-y-6 text-sm">
              <section className="space-y-4 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <h2 className="text-lg font-semibold text-slate-900">{drawerUser.name}</h2>
                    <p className="text-xs text-slate-500">DormMate 계정</p>
                  </div>
                  <Badge
                    variant={drawerUser.status === "ACTIVE" ? "outline" : "destructive"}
                    className="rounded-full px-3 py-1 text-xs font-semibold"
                  >
                    {drawerUser.status === "ACTIVE" ? "활성" : "비활성"}
                  </Badge>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">호실 · 개인번호</p>
                    <p className="font-medium text-slate-900">{formatRoomWithPersonal(drawerUser)}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">마지막 로그인</p>
                    <p className="font-medium text-slate-900">{drawerUser.lastLogin || "기록 없음"}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">기본 역할</p>
                    <p className="font-medium text-slate-900">{primaryRoleLabel ?? "-"}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">알림 선호</p>
                    <p className="text-xs text-slate-500">알림 선호 연동 준비 중</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                  <div className="space-y-0.5">
                    <p className="text-xs text-muted-foreground">추가 권한</p>
                    <p className="font-medium text-slate-900">{extraRoleLabel}</p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={actionLoading || (!canPromoteCurrent && !canDemoteCurrent)}
                    onClick={() => {
                      if (!drawerUser) return
                      setRoleChangeMode(drawerUser.role === "FLOOR_MANAGER" ? "DEMOTE" : "PROMOTE")
                      setRoleChangeReason("")
                      setRoleDialogOpen(true)
                    }}
                  >
                    역할 변경
                  </Button>
                </div>
                <div className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                  권한 변경 후 감사 로그에 사유를 남기고, 층별 공지를 통해 빠르게 공유하세요.
                </div>
              </section>

              <section className="space-y-4 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">벌점 현황</h3>
                    <p className="text-xs text-slate-500">
                      모듈별 벌점을 확인하고 필요한 경우 바로 조치하세요.
                    </p>
                  </div>
                  <Badge
                    variant={drawerUser.penalties && drawerUser.penalties > 0 ? "destructive" : "outline"}
                    className="rounded-full px-3 py-1 text-xs font-semibold"
                  >
                    누적 {drawerUser.penalties ?? 0}점
                  </Badge>
                </div>
                <div className="space-y-2">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                    모듈별 벌점 데이터와 최근 벌점 타임라인 연동은 벌점 허브 확장 시 제공될 예정입니다.
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" className="gap-1" onClick={() => handleAdjustPenalty(drawerUser)}>
                      벌점 차감·삭제
                    </Button>
                    <Button asChild size="sm" variant="ghost" className="gap-1 text-slate-600">
                      <Link href={`/admin/fridge?ownerId=${encodeURIComponent(drawerUser.id)}`}>
                        관련 냉장고 검사 보기
                      </Link>
                    </Button>
                    <Button asChild size="sm" variant="ghost" className="gap-1 text-slate-600">
                      <Link href="/admin/notifications">벌점 알림 템플릿</Link>
                    </Button>
                  </div>
                </div>
              </section>

              <section className="space-y-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-rose-700">위험 작업</h3>
                    <p className="text-xs text-rose-600">
                      계정을 비활성화하면 DormMate 전체 접근이 차단됩니다.
                    </p>
                  </div>
                </div>
                <DangerZoneModal
                  title="계정을 비활성화하시겠습니까?"
                  description="비활성화 시 DormMate 접근이 차단되며, 관련 예약/검사 세션이 모두 정리됩니다."
                  confirmLabel="비활성화"
                  onConfirm={async () => {
                    if (!drawerUser) return
                    await handleDeactivateUser(drawerUser)
                  }}
                />
              </section>

              <Dialog
                open={roleDialogOpen}
                onOpenChange={(open) => {
                  if (!drawerUser) {
                    setRoleDialogOpen(false)
                    setRoleChangeReason("")
                    return
                  }
                  setRoleDialogOpen(open)
                  if (open) {
                    setRoleChangeMode(drawerUser.role === "FLOOR_MANAGER" ? "DEMOTE" : "PROMOTE")
                  } else {
                    setRoleChangeReason("")
                  }
                }}
              >
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>역할 변경</DialogTitle>
                    <DialogDescription>
                      층별장 임명 또는 해제 시 사유를 기록하고 적용하세요.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-1">
                    <div className="space-y-2">
                      <Label htmlFor="role-change-mode" className="text-xs text-muted-foreground">
                        변경 작업
                      </Label>
                      <Select
                        value={roleChangeMode}
                        onValueChange={(value) => setRoleChangeMode(value as RoleChangeMode)}
                        disabled={!drawerUser || (!canPromoteCurrent && !canDemoteCurrent) || actionLoading}
                      >
                        <SelectTrigger id="role-change-mode" className="h-9">
                          <SelectValue placeholder="작업 선택" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="PROMOTE" disabled={!canPromoteCurrent}>
                            층별장 임명
                          </SelectItem>
                          <SelectItem value="DEMOTE" disabled={!canDemoteCurrent}>
                            일반 거주자 전환
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="role-change-reason" className="text-xs text-muted-foreground">
                        사유
                      </Label>
                      <Textarea
                        id="role-change-reason"
                        value={roleChangeReason}
                        onChange={(event) => setRoleChangeReason(event.target.value)}
                        placeholder="예: 해당 층 운영 공백으로 임명"
                        minLength={2}
                        maxLength={200}
                        className="min-h-[96px] resize-y"
                        disabled={actionLoading}
                      />
                      <p className="text-[11px] text-slate-500">내부 감사 로그에 기록됩니다. 최소 2자 이상 입력하세요.</p>
                    </div>
                  </div>
                  <DialogFooter className="gap-2 sm:gap-3">
                    <Button type="button" variant="ghost" onClick={() => setRoleDialogOpen(false)} disabled={actionLoading}>
                      취소
                    </Button>
                    <Button type="button" onClick={handleRoleChangeConfirm} disabled={!canSubmitRoleChange}>
                      변경 적용
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          ) : null}
        </DetailsDrawer>

        {/* 사용자 벌점 전체 요약 카드는 사용자 패널로 이전되었습니다. */}
      </div>

      <div data-admin-slot="rail" className="space-y-4 text-sm">
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-slate-800">신속 링크</h2>
          <div className="space-y-2">
            <QuickLink href="/admin/audit?module=roles" label="권한 변경 감사 로그" />
            <QuickLink href="/admin/notifications" label="층별장 임명 알림 템플릿" />
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

function formatLastLogin(value?: string | null): string {
  if (!value) return "미기록"
  try {
    return format(new Date(value), "MM/dd HH:mm")
  } catch (_error) {
    return "미기록"
  }
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

function compareAdminUsers(a: AdminUser, b: AdminUser): number {
  const floorA = resolveUserFloor(a)
  const floorB = resolveUserFloor(b)
  if (floorA !== floorB) {
    if (floorA === null) return 1
    if (floorB === null) return -1
    return floorA - floorB
  }

  const codeA = resolveRoomCode(a)
  const codeB = resolveRoomCode(b)
  if (codeA || codeB) {
    if (!codeA) return 1
    if (!codeB) return -1
    const codeCompare = codeA.localeCompare(codeB, undefined, { numeric: true, sensitivity: "base" })
    if (codeCompare !== 0) return codeCompare
  }

  const personalA = typeof a.personalNo === "number" ? a.personalNo : Number.POSITIVE_INFINITY
  const personalB = typeof b.personalNo === "number" ? b.personalNo : Number.POSITIVE_INFINITY
  if (personalA !== personalB) {
    return personalA - personalB
  }

  return a.name.localeCompare(b.name, "ko", { sensitivity: "base" })
}

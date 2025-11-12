"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { AlertTriangle, Loader2 } from "lucide-react"
import { format } from "date-fns"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { DangerZoneModal, DetailsDrawer } from "@/components/admin"
import {
  demoteAdminFloorManager,
  deactivateAdminUser,
  promoteAdminFloorManager,
  fetchAdminUsers,
} from "@/features/admin/api"
import { fetchFridgeOwnershipIssues, type FridgeOwnershipIssueItem } from "@/features/admin/api/fridge"
import { useAdminUsers } from "@/features/admin/hooks/use-admin-users"
import type { AdminUser } from "@/features/admin/types"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"

type UserStatusFilter = "ACTIVE" | "INACTIVE"

type FilterState = {
  floor: string
  status: UserStatusFilter
  floorManagerOnly: boolean
  search: string
}

type RoleChangeMode = "PROMOTE" | "DEMOTE"

const ISSUE_TYPE_LABEL: Record<string, string> = {
  NO_ACTIVE_ROOM_ASSIGNMENT: "방 배정 없음",
  ROOM_NOT_ALLOWED_FOR_COMPARTMENT: "접근 권한 없음",
}

export default function AdminUsersPage() {
  const [filters, setFilters] = useState<FilterState>({
    floor: "ALL",
    status: "ACTIVE",
    floorManagerOnly: false,
    search: "",
  })
  const [searchDraft, setSearchDraft] = useState("")
  const [page, setPage] = useState(1)
  const pageSize = 6
  const fetchParams = useMemo(
    () => ({
      status: filters.status,
      floor: filters.floor,
      floorManagerOnly: filters.floorManagerOnly,
      search: filters.search.trim() || undefined,
      page: Math.max(page - 1, 0),
      size: pageSize,
    }),
    [filters.status, filters.floor, filters.floorManagerOnly, filters.search, page, pageSize],
  )
  const { data, loading, error, refetch } = useAdminUsers(fetchParams)
  const isInitialLoading = loading && !data
  const isPageTransitionLoading = loading && !!data
  const userItems = useMemo(() => data?.items ?? [], [data?.items])
  const [drawerUser, setDrawerUser] = useState<AdminUser | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const { toast } = useToast()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pendingFocusId, setPendingFocusId] = useState<string | null>(null)
  const processedFocusIdRef = useRef<string | null>(null)
  const [focusCandidate, setFocusCandidate] = useState<AdminUser | null>(null)
  const [focusTargetPage, setFocusTargetPage] = useState<number | null>(null)
  const [focusLookupLoading, setFocusLookupLoading] = useState(false)
  const [focusLookupAttempted, setFocusLookupAttempted] = useState(false)
  const [focusedUserId, setFocusedUserId] = useState<string | null>(null)
  const [roleDialogOpen, setRoleDialogOpen] = useState(false)
  const [roleChangeMode, setRoleChangeMode] = useState<RoleChangeMode>("PROMOTE")
  const [roleChangeReason, setRoleChangeReason] = useState("")
  const [deactivateReason, setDeactivateReason] = useState("")
  const [ownershipIssues, setOwnershipIssues] = useState<FridgeOwnershipIssueItem[]>([])
  const [ownershipIssuesLoading, setOwnershipIssuesLoading] = useState(false)
  const [ownershipIssuesError, setOwnershipIssuesError] = useState<string | null>(null)
  const focusParam = searchParams.get("focus")

  const primaryRoleLabel = drawerUser
    ? drawerUser.role === "ADMIN"
      ? "관리자"
      : "거주자"
    : undefined
  const canPromoteCurrent = drawerUser != null && drawerUser.role !== "FLOOR_MANAGER"
  const canDemoteCurrent = drawerUser?.role === "FLOOR_MANAGER"
  const trimmedRoleChangeReason = roleChangeReason.trim()
  const canSubmitRoleChange =
    !!drawerUser &&
    (roleChangeMode === "PROMOTE" ? canPromoteCurrent : canDemoteCurrent) &&
    trimmedRoleChangeReason.length >= 2 &&
    !actionLoading
  const trimmedDeactivateReason = deactivateReason.trim()
  const canSubmitSingleDeactivation = !!drawerUser && trimmedDeactivateReason.length >= 2 && !actionLoading
  const fridgeIssuesHref = drawerUser ? `/admin/fridge/issues?ownerId=${encodeURIComponent(drawerUser.id)}` : "/admin/fridge/issues"

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
      setFocusTargetPage(page)
      return
    }
    if (focusLookupAttempted || focusLookupLoading) return
    let cancelled = false
    const lookup = async () => {
      try {
        setFocusLookupLoading(true)
        setFocusLookupAttempted(true)
        const response = await fetchAdminUsers({
          status: "ALL",
          page: 0,
          size: 500,
        })
        if (cancelled) return
        const foundIndex = response.items.findIndex((user) => user.id === pendingFocusId)
        const found = foundIndex >= 0 ? response.items[foundIndex] : null
        if (found) {
          setFocusCandidate(found)
          setFocusTargetPage(Math.floor(foundIndex / pageSize) + 1)
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
  }, [pendingFocusId, userItems, focusLookupAttempted, focusLookupLoading, toast, page, pageSize])

  useEffect(() => {
    if (!loading && data) {
      const serverPage = (data.page ?? 0) + 1
      if (serverPage !== page) {
        setPage(serverPage)
      }
    }
  }, [data, loading, page])

  useEffect(() => {
    if (!drawerUser) {
      setRoleDialogOpen(false)
      setRoleChangeReason("")
      return
    }
    setRoleChangeMode(drawerUser.role === "FLOOR_MANAGER" ? "DEMOTE" : "PROMOTE")
  }, [drawerUser])

  useEffect(() => {
    setSearchDraft(filters.search)
  }, [filters.search])

  useEffect(() => {
    if (!drawerUser) {
      setDeactivateReason("")
      setOwnershipIssues([])
      setOwnershipIssuesError(null)
      setOwnershipIssuesLoading(false)
      return
    }
    let cancelled = false
    const loadIssues = async () => {
      try {
        setOwnershipIssuesLoading(true)
        setOwnershipIssuesError(null)
        const response = await fetchFridgeOwnershipIssues({ ownerId: drawerUser.id, size: 5 })
        if (cancelled) return
        setOwnershipIssues(response.items)
      } catch (err) {
        if (cancelled) return
        setOwnershipIssuesError(err instanceof Error ? err.message : "권한 불일치 데이터를 불러오지 못했습니다.")
        setOwnershipIssues([])
      } finally {
        if (!cancelled) {
          setOwnershipIssuesLoading(false)
        }
      }
    }
    void loadIssues()
    return () => {
      cancelled = true
    }
  }, [drawerUser])

  const availableFloors = useMemo(() => {
    if (data?.availableFloors && data.availableFloors.length > 0) {
      return data.availableFloors
    }
    const set = new Set<number>()
    userItems.forEach((user) => {
      const floor = resolveUserFloor(user)
      if (floor !== null) set.add(floor)
    })
    return Array.from(set).sort((a, b) => a - b)
  }, [data?.availableFloors, userItems])

  const totalItems = data?.totalElements ?? userItems.length
  const totalPages = Math.max(1, data?.totalPages ?? 1)
  const paginated = userItems
  const searchKeyword = filters.search.trim()
  const floorLabel = filters.floor === "ALL" ? "전체 층" : `${filters.floor}F`
  const statusLabel = filters.status === "ACTIVE" ? "활성" : "비활성"
  const floorOptions = useMemo(() => ["ALL", ...availableFloors.map((floor) => String(floor))], [availableFloors])

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
    if (focusTargetPage && page !== focusTargetPage) {
      setPage(focusTargetPage)
      return
    }

    const current = userItems.find((user) => user.id === focusCandidate.id)
    if (!current) {
      return
    }

    setDrawerUser(current)
    setFocusedUserId(current.id)
    processedFocusIdRef.current = current.id
    setPendingFocusId(null)
    setFocusTargetPage(null)

    const params = new URLSearchParams(searchParams.toString())
    params.delete("focus")
    const next = params.toString()
    router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false })
  }, [
    pendingFocusId,
    focusCandidate,
    focusTargetPage,
    filters.status,
    filters.floor,
    userItems,
    page,
    setFilters,
    pathname,
    router,
    searchParams,
  ])

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

  const handleFloorChange = (value: string) => {
    setFilters((prev) => ({ ...prev, floor: value }))
    setPage(1)
  }

  const handleStatusChange = (status: UserStatusFilter) => {
    setFilters((prev) => ({ ...prev, status }))
    setPage(1)
  }

  const handleFloorManagerToggle = (checked: boolean) => {
    setFilters((prev) => ({ ...prev, floorManagerOnly: checked }))
    setPage(1)
  }

  const handleSearchChange = (value: string) => {
    setSearchDraft(value)
  }

  const handleApplySearch = () => {
    setFilters((prev) => ({ ...prev, search: searchDraft.trim() }))
    setPage(1)
  }

  const handleRowClick = (user: AdminUser) => {
    if (actionLoading) return
    openDrawer(user)
  }

  const handlePromoteUser = async (user: AdminUser, reason: string) => {
    const trimmed = reason.trim()
    if (!trimmed) {
      toast({
        title: "사유를 입력하세요.",
        description: "층별장 임명 사유는 최소 2자 이상이어야 합니다.",
        variant: "destructive",
      })
      return
    }
    setActionLoading(true)
    try {
      await promoteAdminFloorManager(user.id, trimmed)
      toast({
        title: "층별장 임명 완료",
        description: `${user.name}님이 층별장으로 임명되었습니다. 사유: ${trimmed}`,
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

  const handleDemoteUser = async (user: AdminUser, reason: string) => {
    const trimmed = reason.trim()
    if (!trimmed) {
      toast({
        title: "사유를 입력하세요.",
        description: "층별장 해제 사유는 최소 2자 이상이어야 합니다.",
        variant: "destructive",
      })
      return
    }
    setActionLoading(true)
    try {
      await demoteAdminFloorManager(user.id, trimmed)
      toast({
        title: "층별장 해제 완료",
        description: `${user.name}님의 층별장 권한을 해제했습니다. 사유: ${trimmed}`,
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

  const handleDeactivateUser = async (user: AdminUser, reason: string) => {
    const trimmed = reason.trim()
    if (!trimmed) {
      toast({
        title: "사유를 입력하세요.",
        description: "계정 비활성화 사유는 최소 2자 이상이어야 합니다.",
        variant: "destructive",
      })
      return
    }
    setActionLoading(true)
    try {
      await deactivateAdminUser(user.id, trimmed)
      toast({
        title: "계정 비활성화 완료",
        description: `${user.name}님의 DormMate 접근이 중단되었습니다. 사유: ${trimmed}`,
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
                층별장 승격/복귀, 관리자 임명, 계정 비활성화를 처리합니다. 변경 이력은 감사 로그에서 추적하세요.
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-sm space-y-5">

          <div className="space-y-3">
            <Label className="text-xs font-semibold uppercase tracking-wide text-slate-600">층 · 검색</Label>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="lg:w-[240px]">
                <Select value={filters.floor} onValueChange={handleFloorChange}>
                  <SelectTrigger className="h-11 rounded-2xl border border-slate-200 bg-white/95 px-4 text-sm font-semibold">
                    <SelectValue placeholder="층 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {floorOptions.map((value) => (
                      <SelectItem key={value} value={value}>
                        {value === "ALL" ? "전체" : `${value}층`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-1 items-center gap-2">
                <div className="flex min-w-[140px] items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-1.5 shadow-sm">
                  <Input
                    value={searchDraft}
                    onChange={(event) => handleSearchChange(event.target.value)}
                    placeholder="이름 · 호실(205)"
                    className="h-9 flex-1 border-none bg-transparent px-0 text-sm focus-visible:ring-0 focus-visible:ring-offset-0"
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault()
                        handleApplySearch()
                      }
                    }}
                  />
                  <Button
                    type="button"
                    size="sm"
                    className="h-9 rounded-xl bg-emerald-600 px-4 text-xs font-semibold text-white hover:bg-emerald-700"
                    onClick={handleApplySearch}
                  >
                    검색
                  </Button>
                </div>
              </div>
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
            <CardHeader className="space-y-2 border-b border-slate-100 py-2">
              <div className="text-base font-semibold text-slate-800">
                {floorLabel} · {statusLabel}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs font-semibold bg-emerald-100 text-emerald-700">
                  총 {totalItems.toLocaleString()}명
                </Badge>
                <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                  <Button
                    type="button"
                    size="sm"
                    variant={filters.status === "INACTIVE" ? "default" : "outline"}
                    className={cn(
                      "rounded-full border px-3 py-1 text-[12px] font-semibold",
                      filters.status === "INACTIVE"
                        ? "bg-emerald-600 text-white hover:bg-emerald-600"
                        : "border-slate-200 bg-white text-slate-600 hover:border-emerald-200 hover:text-emerald-700",
                    )}
                    onClick={() => handleStatusChange(filters.status === "INACTIVE" ? "ACTIVE" : "INACTIVE")}
                  >
                    비활성만
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={filters.floorManagerOnly ? "default" : "outline"}
                    className={cn(
                      "rounded-full border px-3 py-1 text-[12px] font-semibold",
                      filters.floorManagerOnly
                        ? "bg-emerald-600 text-white hover:bg-emerald-600"
                        : "border-slate-200 bg-white text-slate-600 hover:border-emerald-200 hover:text-emerald-700",
                    )}
                    onClick={() => handleFloorManagerToggle(!filters.floorManagerOnly)}
                  >
                    층별장만
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="relative space-y-3">
              {paginated.length === 0 && !loading ? (
                <p className="text-center text-xs text-muted-foreground">표시할 사용자가 없습니다.</p>
              ) : (
                paginated.map((user) => {
                  const penaltiesLabel = `${(user.penalties ?? 0).toLocaleString()}점`
                  const isFocused = focusedUserId === user.id
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
                    disabled={page <= 1 || isPageTransitionLoading}
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
                    disabled={page >= totalPages || isPageTransitionLoading}
                  >
                    다음
                  </Button>
                </div>
              ) : null}
              {isPageTransitionLoading ? (
                <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-2xl bg-white/80 text-xs text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin text-emerald-500" />
                  <span>다음 페이지 데이터를 불러오는 중입니다…</span>
                </div>
              ) : null}
              {isInitialLoading && paginated.length === 0 ? (
                <p className="mt-4 text-xs text-muted-foreground">사용자 데이터를 불러오는 중입니다…</p>
              ) : null}
            </CardContent>
          </Card>

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
                    <p className="text-xs text-slate-500">{formatRoomWithPersonal(drawerUser)}</p>
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
                    <p className="text-xs text-muted-foreground">마지막 로그인</p>
                    <p className="font-medium text-slate-900">{drawerUser.lastLogin || "기록 없음"}</p>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground">기본 역할</p>
                        <p className="font-medium text-slate-900">{primaryRoleLabel ?? "-"}</p>
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
                  </div>
                </div>
              </section>

              <section className="space-y-4 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">벌점 기록</h3>
                    <p className="text-xs text-slate-500">
                      모듈별 벌점 이력을 확인합니다. 조치가 필요한 경우 관련 모듈 화면에서 처리하세요.
                    </p>
                  </div>
                  <Badge
                    variant={drawerUser.penalties && drawerUser.penalties > 0 ? "destructive" : "outline"}
                    className="rounded-full px-3 py-1 text-xs font-semibold"
                  >
                    누적 {drawerUser.penalties ?? 0}점
                  </Badge>
                </div>
                {drawerUser.penaltyRecords && drawerUser.penaltyRecords.length > 0 ? (
                  <div className="space-y-2">
                    {drawerUser.penaltyRecords.map((record, index) => (
                      <div key={`${record.source}-${record.issuedAt}-${index}`} className="rounded-lg border border-slate-100 bg-slate-50/80 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">{record.module}</p>
                            <p className="text-[11px] text-slate-500">{record.issuedAt || "-"}</p>
                          </div>
                          <Badge variant="outline" className="border-rose-200 bg-rose-50 text-[11px] text-rose-700">
                            +{record.points}점
                          </Badge>
                        </div>
                        {record.reason ? (
                          <p className="mt-1 text-xs text-slate-600 whitespace-pre-wrap">{record.reason}</p>
                        ) : (
                          <p className="mt-1 text-xs text-slate-500">사유 없음</p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (drawerUser.penalties ?? 0) > 0 ? (
                  <div className="rounded-lg border border-slate-100 bg-slate-50/80 p-3 text-xs text-slate-600">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">냉장고</p>
                        <p className="text-[11px] text-slate-500">상세 기록 준비 중</p>
                      </div>
                      <Badge variant="outline" className="border-rose-200 bg-rose-50 text-[11px] text-rose-700">
                        +{drawerUser.penalties ?? 0}점
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">벌점 기록 동기화 중입니다.</p>
                  </div>
                ) : (
                  <div className="rounded-lg border border-slate-100 bg-slate-50/80 p-3 text-xs text-slate-500">
                    기록된 벌점이 없습니다.
                  </div>
                )}
              </section>

              <section className="space-y-3 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-sm">
                <div className="flex items-center justify-between gap-2 text-xs font-semibold text-slate-700">
                  <span>냉장고 권한 불일치</span>
                  <Button asChild variant="link" className="h-auto p-0 text-xs text-emerald-600">
                    <Link href={fridgeIssuesHref}>전체 보기</Link>
                  </Button>
                </div>
                {ownershipIssuesLoading ? (
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Loader2 className="size-4 animate-spin text-slate-400" aria-hidden />
                    불일치 데이터를 불러오는 중입니다…
                  </div>
                ) : ownershipIssuesError ? (
                  <p className="text-xs text-rose-600">{ownershipIssuesError}</p>
                ) : ownershipIssues.length === 0 ? (
                  <p className="text-xs text-slate-500">해당 거주자와 연결된 권한 불일치 항목이 없습니다.</p>
                ) : (
                  <div className="space-y-2">
                    {ownershipIssues.map((issue) => (
                      <div key={`${issue.bundleId}-${issue.issueType}`} className="rounded-lg border border-slate-100 bg-slate-50/80 p-2">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-slate-900">
                            {issue.bundleName ?? `라벨 #${issue.labelNumber ?? "-"}`}
                          </p>
                          <Badge variant="outline" className="border-rose-200 bg-rose-50 text-[11px] text-rose-700">
                            {ISSUE_TYPE_LABEL[issue.issueType] ?? issue.issueType}
                          </Badge>
                        </div>
                        <p className="text-xs text-slate-500">
                          {issue.roomFloor ? `${issue.roomFloor}F ` : ""}
                          {issue.roomNumber ?? "호실 미배정"} · 슬롯 {issue.slotIndex ?? "-"}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
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
                  confirmDisabled={!canSubmitSingleDeactivation}
                  onConfirm={async () => {
                    if (!drawerUser) return
                    if (trimmedDeactivateReason.length < 2) {
                      toast({
                        title: "사유를 입력하세요.",
                        description: "비활성화 사유는 최소 2자 이상이어야 합니다.",
                        variant: "destructive",
                      })
                      return
                    }
                    await handleDeactivateUser(drawerUser, trimmedDeactivateReason)
                  }}
                >
                  <div className="space-y-2 text-left">
                    <Label htmlFor="deactivate-reason" className="text-xs text-rose-600">
                      비활성화 사유
                    </Label>
                    <Textarea
                      id="deactivate-reason"
                      placeholder="예: 퇴사 처리"
                      minLength={2}
                      maxLength={200}
                      value={deactivateReason}
                      onChange={(event) => setDeactivateReason(event.target.value)}
                      disabled={actionLoading}
                    />
                    <p className="text-[11px] text-rose-500">사유는 감사 로그에 기록됩니다.</p>
                  </div>
                </DangerZoneModal>
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

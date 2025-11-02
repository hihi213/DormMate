"use client"

import { useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { BulkEditor, DangerZoneModal, DetailsDrawer, FilterBar, PaginatedTable } from "@/components/admin"
import { useAdminResources } from "@/features/admin/hooks/use-admin-resources"
import type { AdminResource } from "@/features/admin/types"

type FacilityType = "fridge" | "laundry" | "library" | "multipurpose"

type ResourceRow = AdminResource

export default function AdminResourcesPage() {
  const [filters, setFilters] = useState<Record<string, string>>({
    search: "",
    status: "all",
    scope: "fridge",
  })
  const [page, setPage] = useState(1)
  const pageSize = 5
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [drawerResource, setDrawerResource] = useState<ResourceRow | null>(null)
  const { data, loading } = useAdminResources()

  const resourceItems = useMemo(() => data?.items ?? [], [data?.items])

  const filteredData = useMemo(() => {
    return resourceItems.filter((row) => {
      const matchesScope =
        filters.scope === "all" ? true : row.facility === (filters.scope as FacilityType)
      const matchesStatus =
        filters.status === "all" ? true : row.status === (filters.status as ResourceRow["status"])
      const keyword = filters.search.trim().toLowerCase()
      const matchesSearch =
        keyword.length === 0 ||
        row.name.toLowerCase().includes(keyword) ||
        row.rooms.toLowerCase().includes(keyword) ||
        row.location.toLowerCase().includes(keyword)
      return matchesScope && matchesStatus && matchesSearch
    })
  }, [filters, resourceItems])

  const totalItems = filteredData.length
  const paginatedData = filteredData.slice((page - 1) * pageSize, page * pageSize)

  const toggleSelection = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      if (checked) {
        return Array.from(new Set([...prev, id]))
      }
      return prev.filter((value) => value !== id)
    })
  }

  const resetSelection = () => setSelectedIds([])

  const openDrawer = (resource: ResourceRow) => {
    setDrawerResource(resource)
  }

  const closeDrawer = () => setDrawerResource(null)

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-xl font-semibold text-slate-800">자원 관리</h1>
        <p className="text-sm text-muted-foreground">
          냉장고·세탁실·도서관·다목적실 자원을 단일 화면에서 관리합니다. 모든 상태 전환과 라벨/호실 재배분 기록은 감사 로그에 남습니다.
        </p>
      </header>

      <FilterBar
        fields={[
          {
            id: "search",
            label: "검색",
            type: "search",
            placeholder: "라벨, 호실, 자원명을 검색",
          },
          {
            id: "status",
            label: "상태",
            type: "select",
            options: [
              { label: "전체", value: "all" },
              { label: "ACTIVE", value: "ACTIVE" },
              { label: "SUSPENDED", value: "SUSPENDED" },
              { label: "REPORTED", value: "REPORTED" },
              { label: "RETIRED", value: "RETIRED" },
            ],
          },
          {
            id: "scope",
            label: "시설",
            type: "segmented",
            options: [
              { label: "전체", value: "all" },
              { label: "냉장고", value: "fridge" },
              { label: "세탁실", value: "laundry" },
              { label: "도서관", value: "library" },
              { label: "다목적실", value: "multipurpose" },
            ],
          },
        ]}
        values={filters}
        onChange={(id, value) => {
          setFilters((prev) => ({ ...prev, [id]: value }))
          setPage(1)
        }}
        actions={
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              setFilters({ search: "", status: "all", scope: "fridge" })
              setPage(1)
            }}
          >
            초기화
          </Button>
        }
      />

      <Card className="shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-slate-800">시설 목록</CardTitle>
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
                header: "자원",
                render: (row) => (
                  <div className="flex flex-col">
                    <span className="font-medium text-slate-900">{row.name}</span>
                    <span className="text-xs text-muted-foreground">{row.location}</span>
                  </div>
                ),
              },
              {
                key: "status",
                header: "상태",
                render: (row) => (
                  <Badge
                    variant={
                      row.status === "ACTIVE"
                        ? "outline"
                        : row.status === "SUSPENDED"
                          ? "destructive"
                          : "secondary"
                    }
                  >
                    {row.status}
                  </Badge>
                ),
              },
              {
                key: "capacity",
                header: "용량/허용량",
              },
              {
                key: "manager",
                header: "담당자",
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
            data={paginatedData}
            pagination={{
              page,
              pageSize,
              totalItems,
              onPageChange: setPage,
            }}
            getRowId={(row) => row.id}
          />
        {loading && paginatedData.length === 0 ? (
            <p className="mt-4 text-xs text-muted-foreground">자원 데이터를 불러오는 중입니다…</p>
          ) : null}
        </CardContent>
      </Card>

      <BulkEditor
        selectedCount={selectedIds.length}
        onClearSelection={resetSelection}
        secondaryActions={[
          {
            id: "suspend",
            label: "중단 요청",
            variant: "outline",
            onSelect: () => {
              if (selectedIds.length > 0) {
                const target = resourceItems.find((row) => row.id === selectedIds[0]) ?? null
                if (target) {
                  setDrawerResource(target)
                }
              }
            },
          },
        ]}
        primaryAction={{
          id: "reassign",
          label: "라벨/호실 재배분",
          onSelect: () => {
            if (selectedIds.length > 0) {
              const target = resourceItems.find((row) => row.id === selectedIds[0]) ?? null
              setDrawerResource(target ?? null)
            }
          },
        }}
      >
        <span className="text-xs text-muted-foreground">
          선택된 자원은 관리 허브 재배분 마법사에서 동일 정책이 적용됩니다.
        </span>
      </BulkEditor>

      <DetailsDrawer
        title={drawerResource?.name ?? ""}
        description={drawerResource ? `${drawerResource.location} · 담당 ${drawerResource.manager}` : ""}
        open={Boolean(drawerResource)}
        onOpenChange={(open) => {
          if (!open) {
            closeDrawer()
          }
        }}
      >
        {drawerResource ? (
          <div className="space-y-4 text-sm">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label className="text-xs text-muted-foreground">현재 상태</Label>
                <p className="font-medium text-slate-900">{drawerResource.status}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">용량/허용량</Label>
                <p className="font-medium text-slate-900">{drawerResource.capacity}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">라벨 범위</Label>
                <p className="font-medium text-slate-900">
                  {drawerResource.labelRange ?? "해당 없음"}
                </p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">담당 호실</Label>
                <p className="font-medium text-slate-900">{drawerResource.rooms}</p>
              </div>
            </div>

            <Separator />

            <div className="grid gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">최근 검사</Label>
                <p className="font-medium text-slate-900">
                  {drawerResource.lastInspection ?? "기록 없음"}
                </p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">이슈</Label>
                <p className="font-medium text-slate-900">
                  {drawerResource.issue ?? "등록된 이슈가 없습니다."}
                </p>
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">위험 작업</Label>
              <DangerZoneModal
                title="선택한 자원을 SUSPENDED 상태로 전환하시겠습니까?"
                description="전환 즉시 거주자 접근이 차단되며, 알림 Outbox에 재발송 기록이 남습니다. 필요 시 자원 재배분 마법사를 통해 다른 칸으로 분산하세요."
                confirmLabel="중단"
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

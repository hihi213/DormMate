"use client"

import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react"

import {
  BulkEditor,
  DangerZoneModal,
  DetailsDrawer,
  FilterBar,
  PaginatedTable,
} from "."
import { Button } from "@/components/ui/button"

const meta: Meta<typeof ComponentGallery> = {
  title: "Admin/Component Gallery",
  component: ComponentGallery,
  parameters: {
    layout: "fullscreen",
  },
  tags: ["autodocs"],
}

export default meta

const sampleData = Array.from({ length: 12 }).map((_, index) => ({
  compartment: `냉장 ${index + 1}번`,
  status: index % 3 === 0 ? "SUSPENDED" : "ACTIVE",
  occupancy: `${(index % 5) + 1}/8`,
}))

function ComponentGallery() {
  const [filters, setFilters] = React.useState<Record<string, string>>({
    search: "",
    status: "all",
    scope: "fridge",
  })
  const [page, setPage] = React.useState(1)
  const [drawerOpen, setDrawerOpen] = React.useState(false)

  const pageSize = 5
  const pagedData = React.useMemo(() => {
    const offset = (page - 1) * pageSize
    return sampleData.slice(offset, offset + pageSize)
  }, [page])

  return (
    <div className="bg-muted/30 flex flex-col gap-6 p-6">
      <FilterBar
        fields={[
          {
            id: "search",
            label: "검색",
            type: "search",
            placeholder: "라벨, 호실, 사용자 검색...",
          },
          {
            id: "status",
            label: "상태",
            type: "select",
            options: [
              { label: "전체", value: "all" },
              { label: "정상", value: "ACTIVE" },
              { label: "중단", value: "SUSPENDED" },
            ],
          },
          {
            id: "scope",
            label: "대상",
            type: "segmented",
            options: [
              { label: "냉장고", value: "fridge" },
              { label: "세탁실", value: "laundry" },
            ],
          },
        ]}
        values={filters}
        onChange={(id, value) =>
          setFilters((prev) => ({
            ...prev,
            [id]: value,
          }))
        }
        actions={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() =>
              setFilters({
                search: "",
                status: "all",
                scope: "fridge",
              })
            }
          >
            초기화
          </Button>
        }
      />

      <PaginatedTable
        columns={[
          { key: "compartment", header: "칸" },
          { key: "status", header: "상태" },
          { key: "occupancy", header: "점유" },
        ]}
        data={pagedData}
        pagination={{
          page,
          pageSize,
          totalItems: sampleData.length,
          onPageChange: setPage,
        }}
      />

      <BulkEditor
        selectedCount={2}
        secondaryActions={[
          {
            id: "suspend",
            label: "중단",
            onSelect: () => undefined,
            variant: "outline",
          },
        ]}
        primaryAction={{
          id: "reassign",
          label: "호실 재배분",
          onSelect: () => setDrawerOpen(true),
        }}
        onClearSelection={() => undefined}
      >
        <span className="text-muted-foreground hidden sm:inline">
          선택된 칸에 동일한 작업이 적용됩니다.
        </span>
      </BulkEditor>

      <div className="flex gap-3">
        <Button type="button" variant="secondary" onClick={() => setDrawerOpen(true)}>
          상세 Drawer 열기
        </Button>
        <DangerZoneModal
          title="칸 상태를 SUSPENDED로 전환하시겠습니까?"
          description="선택한 모든 칸이 즉시 중단되며 거주자는 접근할 수 없습니다. 필요한 경우 사후에 알림을 재발송하세요."
          confirmLabel="중단"
          onConfirm={() => Promise.resolve()}
        />
      </div>

      <DetailsDrawer
        title="냉장 2번 칸 상세"
        description="라벨 및 호실 매핑, 최근 검사 이력을 확인하세요."
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        footer={
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDrawerOpen(false)}
            >
              닫기
            </Button>
            <Button type="button">저장</Button>
          </div>
        }
      >
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-muted-foreground">현재 상태</dt>
            <dd className="font-medium">ACTIVE</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">최대 용량</dt>
            <dd className="font-medium">8</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">라벨 범위</dt>
            <dd className="font-medium">A201 ~ A240</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">담당 층별장</dt>
            <dd className="font-medium">박층장</dd>
          </div>
        </dl>
      </DetailsDrawer>
    </div>
  )
}

export const Gallery: StoryObj<typeof ComponentGallery> = {
  render: () => <ComponentGallery />,
}

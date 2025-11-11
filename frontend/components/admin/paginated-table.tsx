"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export type TableColumn<TData> = {
  key: keyof TData | string
  header: string
  align?: "left" | "center" | "right"
  width?: string
  render?: (row: TData, index: number) => React.ReactNode
}

export type PaginationState = {
  page: number
  pageSize: number
  totalItems: number
}

export type PaginatedTableProps<TData> = {
  columns: TableColumn<TData>[]
  data: TData[]
  emptyMessage?: string
  pagination?: PaginationState & {
    onPageChange?: (page: number) => void
  }
  getRowId?: (row: TData, index: number) => React.Key
  onRowClick?: (row: TData, index: number) => void
  className?: string
  getRowClassName?: (row: TData, index: number) => string | undefined
}

/**
 * 관리자 대시보드와 모듈별 리스트 화면에서 재사용하는 테이블 스켈레톤.
 * 열 정의와 페이지네이션 콜백만 주입하면 동일한 시각 패턴을 재사용할 수 있다.
 */
export function PaginatedTable<TData>({
  columns,
  data,
  emptyMessage = "표시할 데이터가 없습니다.",
  pagination,
  getRowId,
  onRowClick,
  className,
  getRowClassName,
}: PaginatedTableProps<TData>) {
  const totalPages = React.useMemo(() => {
    if (!pagination) return 1
    return Math.max(1, Math.ceil(pagination.totalItems / pagination.pageSize))
  }, [pagination])

  const changePage = React.useCallback(
    (next: number) => (event: React.MouseEvent<HTMLAnchorElement>) => {
      event.preventDefault()
      if (!pagination?.onPageChange) return
      if (next < 1 || next > totalPages || next === pagination.page) return
      pagination.onPageChange(next)
    },
    [pagination, totalPages]
  )

  const renderPageLinks = React.useMemo(() => {
    if (!pagination) return null
    const { page } = pagination
    const pages = new Set<number>()
    pages.add(1)
    pages.add(totalPages)
    pages.add(page)
    pages.add(page - 1)
    pages.add(page + 1)

    const sorted = Array.from(pages)
      .filter((value) => value >= 1 && value <= totalPages)
      .sort((a, b) => a - b)

    let lastPage = 0
    return sorted.map((value) => {
      const items: React.ReactNode[] = []
      if (value - lastPage > 1) {
        items.push(
          <PaginationItem key={`ellipsis-${value}`}>
            <span className="px-2 text-xs text-muted-foreground">…</span>
          </PaginationItem>
        )
      }
      items.push(
        <PaginationItem key={`page-${value}`}>
          <PaginationLink
            href="#"
            isActive={value === page}
            onClick={changePage(value)}
          >
            {value}
          </PaginationLink>
        </PaginationItem>
      )
      lastPage = value
      return items
    })
  }, [pagination, totalPages, changePage])

  return (
    <div
      data-component="admin-paginated-table"
      className={cn("flex flex-col gap-4", className)}
    >
      <div className="w-full overflow-x-auto">
        <Table className="min-w-[720px] md:min-w-0">
          <TableHeader>
            <TableRow>
              {columns.map((column) => (
                <TableHead
                  key={String(column.key)}
                  style={column.width ? { width: column.width } : undefined}
                  className={cn({
                    "text-right": column.align === "right",
                    "text-center": column.align === "center",
                  })}
                >
                  {column.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length}>
                  <div className="text-muted-foreground text-center text-sm py-6">
                    {emptyMessage}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              data.map((row, index) => {
                const clickable = Boolean(onRowClick)
                return (
                  <TableRow
                    key={getRowId ? getRowId(row, index) : index}
                    data-row-index={index}
                    className={cn(
                      clickable && "cursor-pointer transition hover:bg-muted/40",
                      getRowClassName?.(row, index),
                    )}
                    onClick={() => onRowClick?.(row, index)}
                    onKeyDown={(event) => {
                      if (!onRowClick) return
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault()
                        onRowClick(row, index)
                      }
                    }}
                    tabIndex={clickable ? 0 : undefined}
                    role={clickable ? "button" : undefined}
                  >
                    {columns.map((column) => {
                      const cellValue = column.render
                        ? column.render(row, index)
                        : ((row as Record<string, unknown>)[column.key as string] ?? "—")
                      return (
                        <TableCell
                          key={String(column.key)}
                          className={cn({
                            "text-right": column.align === "right",
                            "text-center": column.align === "center",
                          })}
                        >
                          {cellValue as React.ReactNode}
                        </TableCell>
                      )
                    })}
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
      {pagination ? (
        <Pagination className="sm:justify-end">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                href="#"
                onClick={changePage((pagination?.page ?? 1) - 1)}
                />
              </PaginationItem>
              {renderPageLinks}
              <PaginationItem>
                <PaginationNext
                  href="#"
                  onClick={changePage((pagination?.page ?? 1) + 1)}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
      ) : null}
    </div>
  )
}

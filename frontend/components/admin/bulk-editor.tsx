"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

export type BulkEditorAction = {
  id: string
  label: string
  onSelect: () => void
  variant?: React.ComponentProps<typeof Button>["variant"]
  disabled?: boolean
}

export type BulkEditorProps = {
  selectedCount: number
  primaryAction?: BulkEditorAction
  secondaryActions?: BulkEditorAction[]
  onClearSelection?: () => void
  children?: React.ReactNode
  className?: string
}

/**
 * 관리자 화면에서 다중 선택 후 일괄 조정을 처리하는 공통 바.
 * 상단 고정 영역 혹은 테이블 하단에 배치해 선택 상태와 가능한 액션을 명확히 안내한다.
 */
export function BulkEditor({
  selectedCount,
  primaryAction,
  secondaryActions = [],
  onClearSelection,
  children,
  className,
}: BulkEditorProps) {
  const isDisabled = selectedCount === 0

  return (
    <aside
      data-component="admin-bulk-editor"
      className={cn(
        "bg-muted/50 border-border flex flex-wrap items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm",
        className
      )}
    >
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 font-medium">
          선택됨
          <Badge variant="secondary">{selectedCount}</Badge>
        </div>
        {onClearSelection ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={isDisabled}
            onClick={onClearSelection}
          >
            선택 해제
          </Button>
        ) : null}
        {children}
      </div>
      <div className="flex items-center gap-2">
        {secondaryActions.map((action) => (
          <Button
            key={action.id}
            type="button"
            variant={action.variant ?? "ghost"}
            size="sm"
            disabled={isDisabled || action.disabled}
            onClick={action.onSelect}
          >
            {action.label}
          </Button>
        ))}
        {primaryAction ? (
          <Button
            type="button"
            variant={primaryAction.variant ?? "default"}
            disabled={isDisabled || primaryAction.disabled}
            onClick={primaryAction.onSelect}
          >
            {primaryAction.label}
          </Button>
        ) : null}
      </div>
    </aside>
  )
}

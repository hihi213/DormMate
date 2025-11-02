"use client"

import * as React from "react"
import { FunnelIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"

type FilterFieldType = "search" | "select" | "segmented"

export type FilterOption = {
  label: string
  value: string
  badge?: React.ReactNode
}

export type FilterField = {
  id: string
  label: string
  type: FilterFieldType
  placeholder?: string
  options?: FilterOption[]
  disabled?: boolean
}

export type FilterBarProps = {
  fields: FilterField[]
  values: Record<string, string>
  onChange: (id: string, value: string) => void
  actions?: React.ReactNode
  className?: string
}

/**
 * Admin 전용 필터 바 스켈레톤.
 * 검색/선택/세그먼트 토글을 공통 UI 패턴으로 제공해 페이지별로 일관된 상단 필터 경험을 만든다.
 */
export function FilterBar({
  fields,
  values,
  onChange,
  actions,
  className,
}: FilterBarProps) {
  const handleSelect = React.useCallback(
    (id: string) => (value: string) => {
      onChange(id, value)
    },
    [onChange]
  )

  return (
    <section
      data-component="admin-filter-bar"
      className={cn(
        "bg-background/60 border-border text-sm shadow-xs flex flex-wrap items-center gap-3 rounded-lg border p-3",
        className
      )}
    >
      <div className="text-muted-foreground flex items-center gap-2 text-xs uppercase tracking-wide">
        <FunnelIcon className="size-4" />
        Filters
      </div>
      <div className="flex flex-1 flex-wrap items-center gap-3">
        {fields.map((field) => {
          const value = values[field.id] ?? ""
          if (field.type === "search") {
            return (
              <label
                key={field.id}
                className="flex min-w-[220px] flex-1 items-center gap-2"
              >
                <span className="sr-only">{field.label}</span>
                <Input
                  aria-label={field.label}
                  placeholder={field.placeholder ?? field.label}
                  value={value}
                  disabled={field.disabled}
                  onChange={(event) => onChange(field.id, event.target.value)}
                />
              </label>
            )
          }

          if (field.type === "segmented" && field.options) {
            return (
              <div
                key={field.id}
                className="bg-muted/60 border-border text-sm flex items-center gap-1 rounded-md border px-1 py-1"
                role="group"
                aria-label={field.label}
              >
                {field.options.map((option) => {
                  const isActive = option.value === value
                  return (
                    <Button
                      key={option.value}
                      type="button"
                      size="sm"
                      variant={isActive ? "secondary" : "ghost"}
                      className="min-w-[72px]"
                      disabled={field.disabled}
                      onClick={() => onChange(field.id, option.value)}
                    >
                      <span className="flex items-center gap-1">
                        {option.label}
                        {option.badge}
                      </span>
                    </Button>
                  )
                })}
              </div>
            )
          }

          if (field.type === "select" && field.options) {
            return (
              <div key={field.id} className="flex items-center gap-2">
                <label className="text-muted-foreground text-xs uppercase tracking-wide">
                  {field.label}
                </label>
                <Select
                  value={value}
                  onValueChange={handleSelect(field.id)}
                  disabled={field.disabled}
                >
                  <SelectTrigger className="min-w-[160px]" size="sm">
                    <SelectValue placeholder={field.placeholder ?? "전체"} />
                  </SelectTrigger>
                  <SelectContent>
                    {field.options.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        <span className="flex items-center gap-2">
                          {option.label}
                          {option.badge}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )
          }

          return null
        })}
      </div>
      {actions ? (
        <div className="flex items-center gap-2">{actions}</div>
      ) : null}
    </section>
  )
}

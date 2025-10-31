"use client"

import type React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import QuantityStepper from "@/components/shared/quantity-stepper"
import { ExpiryInput } from "@/components/shared/expiry-input"
import type { TemplateState } from "./types"
import { PackagePlus, Pencil } from "lucide-react"
import { cn } from "@/lib/utils"
import { NAME_LIMIT, QTY_LIMIT, WARNING_EXPIRY_DAYS } from "./constants"

interface FormFieldsProps {
  template: TemplateState
  onTemplateChange: (updates: Partial<TemplateState>) => void
  onQuantityChange: (qty: number) => void
  onExpiryChange: (expiryDate: string) => void
  onSubmit: () => void
  nameInputRef?: React.MutableRefObject<HTMLInputElement | null> | null
  onNameLimit?: () => void
  onQuantityLimit?: (which: "min" | "max") => void
  isEditing?: boolean
  highlightName?: boolean
  onCancelEdit?: () => void
}

export function FormFields({
  template,
  onTemplateChange,
  onQuantityChange,
  onExpiryChange,
  onSubmit,
  nameInputRef,
  highlightName = false,
  onNameLimit,
  onQuantityLimit,
  isEditing = false,
  onCancelEdit,
}: FormFieldsProps) {
  const addDisabled = !template.name.trim()

  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <div className="flex-1 min-w-[200px] sm:w-64">
          <label htmlFor="item-name" className="block text-sm font-medium text-gray-800">
            품목명
          </label>
          <div className="relative mt-0.5">
            <Input
              id="item-name"
              ref={nameInputRef ?? undefined}
              value={template.name}
              maxLength={NAME_LIMIT}
              onChange={(e) => {
                const raw = e.target.value
                if (raw.length > NAME_LIMIT && onNameLimit) onNameLimit()
                const next = raw.slice(0, NAME_LIMIT)
                onTemplateChange({ name: next })
              }}
              placeholder="예: 우유 1L"
              className={cn(
                "h-10 pr-16 text-sm",
                highlightName && "ring-2 ring-emerald-300 ring-offset-1"
              )}
            />
            {template.name.length > 0 && (
              <span
                className={cn(
                  "absolute right-3 top-1/2 -translate-y-1/2 text-[11px]",
                  template.name.length >= NAME_LIMIT ? "text-rose-600 font-semibold" : "text-muted-foreground"
                )}
                aria-live="polite"
              >
                {`${template.name.length}/${NAME_LIMIT}`}
              </span>
            )}
          </div>
        </div>
      </div>

      <ExpiryInput
        id="expiry"
        label="유통기한"
        value={template.expiryDate}
        onChange={onExpiryChange}
        warningThresholdDays={WARNING_EXPIRY_DAYS}
        emphasizeToday
        className="max-w-xs"
        inputClassName="w-28"
      />

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-800">수량</label>
        <QuantityStepper
          className="w-full max-w-[200px] justify-between sm:w-auto sm:justify-start"
          value={template.qty}
          min={1}
          max={QTY_LIMIT}
          onChange={onQuantityChange}
          onLimitReach={onQuantityLimit}
          inputClassName="h-9"
        />
      </div>

      <div className="mt-1 flex flex-wrap items-center gap-2">
        {isEditing && onCancelEdit && (
          <Button
            type="button"
            variant="ghost"
            onClick={onCancelEdit}
            className="inline-flex h-9 min-w-[120px] items-center justify-center text-[13px] font-medium text-slate-700 transition hover:bg-slate-100"
          >
            수정 취소
          </Button>
        )}
        <Button
          type="button"
          onClick={onSubmit}
          disabled={addDisabled}
          className={cn(
            "inline-flex h-9 items-center justify-center gap-2 rounded-md text-[13px] font-semibold text-white transition",
            isEditing ? "min-w-[120px] px-3.5" : "w-full min-w-[140px] sm:w-auto sm:min-w-[120px] sm:px-3.5",
            isEditing
              ? "bg-amber-600 hover:bg-amber-700 disabled:bg-gray-300 disabled:text-gray-500"
              : "bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 disabled:text-gray-500",
          )}
        >
          {isEditing ? <Pencil className="h-4 w-4" /> : <PackagePlus className="h-4 w-4" />}
          {isEditing ? "수정 완료" : "포장에 담기"}
        </Button>
      </div>
    </section>
  )
}

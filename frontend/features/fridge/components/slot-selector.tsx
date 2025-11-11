"use client"

import { Check, ChevronDown } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import type { Slot } from "@/features/fridge/types"
import React from "react"
import { cn } from "@/lib/utils"
import { formatSlotDisplayName } from "@/features/fridge/utils/labels"

interface SlotSelectorProps {
  value: string
  onChange: (slotId: string) => void
  slots: Slot[]
  placeholder?: string
  showAllOption?: boolean
  className?: string
  isSelectable?: (slot: Slot) => boolean
  getDisabledDescription?: (slot: Slot) => string | undefined
  statusBadge?: React.ReactNode
}

export function SlotSelector({
  value,
  onChange,
  slots,
  placeholder = "칸을 선택하세요",
  showAllOption = false,
  className = "",
  isSelectable,
  getDisabledDescription,
  statusBadge,
}: SlotSelectorProps) {
  const [open, setOpen] = React.useState(false)

  const canSelect = isSelectable ?? (() => true)
  const disabledDescription = getDisabledDescription ?? (() => undefined)

  const findFirstSelectable = React.useCallback(() => {
    return slots.find((slot) => canSelect(slot))
  }, [slots, canSelect])

  const selectedSlot = React.useMemo(
    () => slots.find((candidate) => candidate.slotId === value) ?? null,
    [slots, value],
  )
  const selectedDisabled = React.useMemo(
    () => (selectedSlot ? !canSelect(selectedSlot) : false),
    [selectedSlot, canSelect],
  )

  // 기본값이 없고 칸이 있을 때 첫 번째 칸을 자동 선택
  React.useEffect(() => {
    if (showAllOption) return
    if ((!value || selectedDisabled) && slots.length > 0) {
      const firstAvailable = findFirstSelectable()
      if (firstAvailable && firstAvailable.slotId !== value) {
        onChange(firstAvailable.slotId)
      } else if (!firstAvailable && value && selectedDisabled) {
        onChange("")
      }
    }
  }, [value, slots, onChange, showAllOption, findFirstSelectable, selectedDisabled])

  const currentSlotLabel = React.useMemo(() => {
    if (showAllOption && !value) {
      return "전체 칸"
    }
    return selectedSlot ? formatSlotDisplayName(selectedSlot) : placeholder
  }, [showAllOption, value, selectedSlot, placeholder])

  const handleSlotSelect = (slotId: string) => {
    onChange(slotId)
    setOpen(false)
  }

  return (
    <div className={`min-w-0 ${className}`}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            className="w-full justify-between bg-transparent inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-gray-50"
            aria-haspopup="dialog"
            aria-controls="slot-popover"
            aria-disabled={selectedDisabled}
          >
            <span className="flex-1 text-left whitespace-nowrap">{currentSlotLabel}</span>
            {statusBadge ? <span className="shrink-0">{statusBadge}</span> : null}
            <ChevronDown className="w-4 h-4 text-gray-500" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          id="slot-popover"
          side="bottom"
          align="start"
          className="w-[var(--radix-popover-trigger-width)] max-w-full p-0"
        >
          <div className="max-h-72 overflow-y-auto">
            {showAllOption && (
              <>
                <SlotOption
                  label="전체 칸"
                  selected={value === ""}
                  onSelect={() => handleSlotSelect("")}
                />
                <div className="border-t my-1" />
              </>
            )}
            {slots.map((slot) => (
              <SlotOption
                key={slot.slotId}
                label={formatSlotDisplayName(slot)}
                selected={value === slot.slotId}
                disabled={!canSelect(slot)}
                description={!canSelect(slot) ? disabledDescription(slot) : undefined}
                onSelect={() => handleSlotSelect(slot.slotId)}
              />
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}

function SlotOption({
  label,
  selected = false,
  disabled = false,
  description,
  onSelect = () => {},
}: {
  label: string
  selected?: boolean
  disabled?: boolean
  description?: string
  onSelect?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      className={cn(
        "w-full flex flex-col items-start gap-1 px-3 py-2 text-sm text-left border-b last:border-b-0",
        selected ? "bg-emerald-50" : "hover:bg-gray-50",
        disabled ? "cursor-not-allowed text-gray-400 hover:bg-transparent" : "cursor-pointer text-gray-900",
      )}
      aria-pressed={selected}
      aria-disabled={disabled}
      title={description ?? undefined}
    >
      <span className="flex w-full items-center justify-between gap-2 text-left">
        <span className="flex-1 text-left">{label}</span>
        <Check
          className={cn(
            "w-4 h-4 text-emerald-600",
            selected ? "opacity-100" : "opacity-0",
            disabled && "opacity-0",
          )}
          aria-hidden="true"
        />
      </span>
    </button>
  )
}

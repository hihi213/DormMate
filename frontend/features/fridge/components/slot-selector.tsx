"use client"

import { Check, ChevronDown } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import type { Slot } from "@/features/fridge/types"
import React from "react"

interface SlotSelectorProps {
  value: string
  onChange: (slotId: string) => void
  slots: Slot[]
  placeholder?: string
  showAllOption?: boolean
  className?: string
}

export function SlotSelector({
  value,
  onChange,
  slots,
  placeholder = "칸을 선택하세요",
  showAllOption = false,
  className = ""
}: SlotSelectorProps) {
  const [open, setOpen] = React.useState(false)

  // 기본값이 없고 칸이 있을 때 첫 번째 칸을 자동 선택
  React.useEffect(() => {
    if (!value && slots.length > 0 && !showAllOption) {
      onChange(slots[0].slotId)
    }
  }, [value, slots, onChange, showAllOption])

  const currentSlotLabel =
    showAllOption && !value
      ? "전체 칸"
      : slots.find((s) => s.slotId === value)?.displayName ?? placeholder

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
          >
            <span className="truncate">{currentSlotLabel}</span>
            <ChevronDown className="w-4 h-4 text-gray-500" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          id="slot-popover"
          side="bottom"
          align="start"
          className="w-[90vw] sm:w-[340px] max-w-[360px] p-0"
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
                label={slot.displayName ?? slot.slotLetter}
                selected={value === slot.slotId}
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
  onSelect = () => {},
}: {
  label: string
  selected?: boolean
  onSelect?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-gray-50 ${selected ? "bg-emerald-50" : ""}`}
      aria-pressed={selected}
    >
      <span className="truncate mr-2">{label}</span>
      <Check className={`w-4 h-4 text-emerald-600 ${selected ? "opacity-100" : "opacity-0"}`} aria-hidden="true" />
    </button>
  )
}

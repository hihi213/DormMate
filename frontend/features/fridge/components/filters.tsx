"use client"

import { useMemo } from "react"
import type { Slot } from "@/features/fridge/types"
import { Button } from "@/components/ui/button"
import { SearchIcon } from "lucide-react"
import { SlotSelector } from "@/features/fridge/components/slot-selector"
import SearchBar from "@/features/fridge/components/search-bar"

export default function Filters({
  active = "all",
  onChange = () => {},
  slotId = "",
  setSlotId = () => {},
  slots = [],
  counts = { mine: 0, expiring: 0, expired: 0 },
  searchValue = "",
  onSearchChange = () => {},
  allowAllSlots = true,
  actionSlot,
}: {
  active?: "all" | "mine" | "expiring" | "expired"
  onChange?: (t: "all" | "mine" | "expiring" | "expired") => void
  slotId?: string
  setSlotId?: (id: string) => void
  slots?: Slot[]
  counts?: { mine: number; expiring: number; expired: number }
  searchValue?: string
  onSearchChange?: (v: string) => void
  allowAllSlots?: boolean
  actionSlot?: React.ReactNode
}) {
  // Only status filters: expiring/expired (tap active to reset to 'all')
  const statusTabs: { key: "expiring" | "expired"; label: string; count?: number }[] = [
    { key: "expiring", label: "임박", count: counts.expiring },
    { key: "expired", label: "만료", count: counts.expired },
  ]

  const slotPlaceholder = allowAllSlots ? "전체 칸" : "내 칸 선택"

  return (
    <div className="mt-3 space-y-3">
      {/* Row 1: Slot picker + Search on the same line */}
      <div className="flex items-center gap-2">
        <SlotSelector
          value={slotId}
          onChange={setSlotId}
          slots={slots}
          showAllOption={allowAllSlots}
          placeholder={slotPlaceholder}
          className="shrink-0 max-w-[55%]"
        />
        
        <div className="flex-1 min-w-0">
          <SearchBar
            value={searchValue}
            onChange={onSearchChange}
            placeholder="식별번호 또는 이름으로 검색"
            rightIcon={<SearchIcon className="size-4 text-gray-500" aria-hidden="true" />}
          />
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {statusTabs.map((t) => {
            const isActive = active === t.key
            return (
              <Button
                key={t.key}
                size="sm"
                variant={isActive ? "default" : "outline"}
                className="shrink-0"
                onClick={() => onChange(isActive ? "all" : t.key)}
                aria-pressed={isActive}
              >
                {t.label}
                {t.count !== undefined && <span className="ml-1 text-xs opacity-80">{t.count}</span>}
              </Button>
            )
          })}
        </div>
        {actionSlot}
      </div>
    </div>
  )
}

"use client"

import { useMemo, useState } from "react"
import type { Slot } from "@/features/fridge/types"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { SearchIcon, Check } from "lucide-react"
import { SlotSelector } from "@/features/fridge/components/slot-selector"
import SearchBar from "@/features/fridge/components/search-bar"

export default function Filters({
  active = "all",
  onChange = () => {},
  slotCode = "",
  setSlotCode = () => {},
  slots = [],
  counts = { mine: 0, expiring: 0, expired: 0 },
  myOnly = true,
  onToggleMyOnly = () => {},
  searchValue = "",
  onSearchChange = () => {},
}: {
  active?: "all" | "mine" | "expiring" | "expired"
  onChange?: (t: "all" | "mine" | "expiring" | "expired") => void
  slotCode?: string
  setSlotCode?: (code: string) => void
  slots?: Slot[]
  counts?: { mine: number; expiring: number; expired: number }
  myOnly?: boolean
  onToggleMyOnly?: (v: boolean) => void
  searchValue?: string
  onSearchChange?: (v: string) => void
}) {
  // Only status filters: expiring/expired (tap active to reset to 'all')
  const statusTabs: { key: "expiring" | "expired"; label: string; count?: number }[] = [
    { key: "expiring", label: "임박", count: counts.expiring },
    { key: "expired", label: "만료", count: counts.expired },
  ]

  return (
    <div className="mt-3 space-y-3">
      {/* Row 1: Slot picker + Search on the same line */}
      <div className="flex items-center gap-2">
        <SlotSelector
          value={slotCode}
          onChange={setSlotCode}
          slots={slots}
          showAllOption
          placeholder="전체 칸"
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

      {/* Row 2: Status chips + '내 물품만' switch */}
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

        <label className="inline-flex items-center gap-2 text-xs text-gray-700">
          <span>{"내 물품만"}</span>
          <Switch checked={myOnly} onCheckedChange={onToggleMyOnly} aria-label="내 물품만 보기" />
        </label>
      </div>
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
      {selected && <Check className="size-4 text-emerald-600 shrink-0" aria-hidden="true" />}
    </button>
  )
}

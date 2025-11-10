"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import dynamic from "next/dynamic"
import { Snowflake, Plus } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { FridgeProvider, useFridge } from "@/features/fridge/hooks/fridge-context"
import type { Item } from "@/features/fridge/types"
import Filters from "@/features/fridge/components/filters"
import ItemsList from "@/features/fridge/components/items-list"
import BottomNav from "@/components/bottom-nav"
import { getCurrentUser, getCurrentUserId, type RoomDetails } from "@/lib/auth"
import AddItemDialog from "@/features/fridge/components/add-item-dialog"
import { formatKoreanDate } from "./utils-fridge-page"
import AuthGuard from "@/features/auth/components/auth-guard"
import { useToast } from "@/hooks/use-toast"
import { fetchNextInspectionSchedule, fetchInspectionSchedules } from "@/features/inspections/api"
import { formatSlotDisplayName } from "@/features/fridge/utils/labels"
import type { InspectionSchedule } from "@/features/inspections/types"
import type { Slot } from "@/features/fridge/types"

// Lazy load heavier bottom sheets
const ItemDetailSheet = dynamic(() => import("@/features/fridge/components/item-detail-sheet"), { ssr: false })
const BundleDetailSheet = dynamic(() => import("@/features/fridge/components/bundle-detail-sheet"), { ssr: false })

export default function FridgePage() {
  return (
    <AuthGuard>
      <FridgeProvider>
        <FridgeInner />
        <BottomNav />
      </FridgeProvider>
    </AuthGuard>
  )
}

function FridgeInner() {
  const { items, slots, bundles, initialLoadError, refreshAll } = useFridge()
  const { toast } = useToast()
  const currentUser = getCurrentUser()
  const isAdmin = currentUser?.roles.includes("ADMIN") ?? false
  const [query, setQuery] = useState("")
  const [tab, setTab] = useState<"all" | "mine" | "expiring" | "expired">("all")
  const [selectedSlotId, setSelectedSlotId] = useState<string>("")
  const [addOpen, setAddOpen] = useState(false)
  const [myOnly, setMyOnly] = useState(true)
  const [nextScheduleText, setNextScheduleText] = useState<string>("")
  const [itemSheet, setItemSheet] = useState<{ open: boolean; id: string; edit?: boolean }>({
    open: false,
    id: "",
    edit: false,
  })
  const [bundleSheet, setBundleSheet] = useState<{ open: boolean; id: string; edit?: boolean }>({
    open: false,
    id: "",
    edit: false,
  })
  const uid = getCurrentUserId()

  const ownedSlotIds = useMemo(() => {
    if (!uid) return []
    const ids = new Set<string>()
    bundles.forEach((bundle) => {
      if (!bundle.slotId) return
      if (bundle.ownerId && bundle.ownerId === uid) {
        ids.add(bundle.slotId)
      } else if (bundle.ownerUserId && bundle.ownerUserId === uid) {
        ids.add(bundle.slotId)
      } else if (!bundle.ownerId && bundle.owner === "me") {
        ids.add(bundle.slotId)
      }
    })
    const activeIds = Array.from(ids).filter((slotId) => {
      const slot = slots.find((s) => s.slotId === slotId)
      return slot ? slot.resourceStatus === "ACTIVE" : true
    })
    activeIds.sort((a, b) => {
      const slotA = slots.find((slot) => slot.slotId === a)
      const slotB = slots.find((slot) => slot.slotId === b)
      const indexA = slotA ? slotA.slotIndex : Number.MAX_SAFE_INTEGER
      const indexB = slotB ? slotB.slotIndex : Number.MAX_SAFE_INTEGER
      return indexA - indexB
    })
    return activeIds
  }, [bundles, uid, slots])

  const isFloorManager = currentUser?.roles.includes("FLOOR_MANAGER") ?? false
  const restrictSlotViewToOwnership = !(isAdmin || isFloorManager)
  const roomDetails = currentUser?.roomDetails ?? null

  const permittedSlotIds = useMemo(() => {
    if (!restrictSlotViewToOwnership) return null
    if (!roomDetails?.floor) return null
    return computePermittedSlotIds({
      slots,
      roomDetails,
    })
  }, [restrictSlotViewToOwnership, roomDetails, slots])

  const visibleSlots = useMemo(() => {
    if (!permittedSlotIds || permittedSlotIds.size === 0) {
      return slots
    }
    const filtered = slots.filter((slot) => permittedSlotIds.has(slot.slotId))
    return filtered.length > 0 ? filtered : slots
  }, [permittedSlotIds, slots])

  useEffect(() => {
    if (!restrictSlotViewToOwnership) return
    if (!permittedSlotIds || permittedSlotIds.size === 0) return
    const availableSlotIds = Array.from(permittedSlotIds)
    const preferredOwned = ownedSlotIds.find((id) => permittedSlotIds.has(id))
    const fallbackSlotId = preferredOwned ?? availableSlotIds[0]
    if (!selectedSlotId || !permittedSlotIds.has(selectedSlotId)) {
      setSelectedSlotId(fallbackSlotId)
    }
  }, [restrictSlotViewToOwnership, permittedSlotIds, ownedSlotIds, selectedSlotId])

  useEffect(() => {
    if (typeof window === "undefined") return
    const intervalId = window.setInterval(() => {
      void refreshAll()
    }, 60000)
    return () => {
      window.clearInterval(intervalId)
    }
  }, [refreshAll])

  useEffect(() => {
    let cancelled = false

    const formatScheduleSummary = (schedule: InspectionSchedule | null): string => {
      if (!schedule) return restrictSlotViewToOwnership ? "내 칸 일정 없음" : "예정 없음"
      const dateText = formatKoreanDate(new Date(schedule.scheduledAt))
      const linkedSlot = schedule.fridgeCompartmentId
        ? slots.find((slot) => slot.slotId === schedule.fridgeCompartmentId)
        : null
      let slotText: string | null = null
      if (linkedSlot) {
        const slotLabel = formatSlotDisplayName(linkedSlot)
        slotText = linkedSlot.floorNo ? `${linkedSlot.floorNo}F ${slotLabel}` : slotLabel
      } else if (schedule.slotLetter) {
        const floorPrefix = schedule.floorNo ? `${schedule.floorNo}F ` : ""
        slotText = `${floorPrefix}칸 ${schedule.slotLetter}`
      }
      return slotText ? `${dateText} · ${slotText}` : dateText
    }

    const loadResidentSchedule = async () => {
      const permittedIds = permittedSlotIds ? Array.from(permittedSlotIds) : []
      const targetSlotIds = permittedIds.length > 0 ? permittedIds : ownedSlotIds
      if (targetSlotIds.length === 0) {
        setNextScheduleText("내 칸 일정 없음")
        return
      }
      try {
        const schedules = await fetchInspectionSchedules({ status: "SCHEDULED", limit: 20 })
        if (cancelled) return
        const relevant = schedules
          .filter(
            (schedule) =>
              schedule.fridgeCompartmentId && targetSlotIds.includes(schedule.fridgeCompartmentId),
          )
          .sort(
            (a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime(),
          )
        if (relevant.length === 0) {
          setNextScheduleText("내 칸 일정 없음")
          return
        }
        setNextScheduleText(formatScheduleSummary(relevant[0]))
      } catch (error) {
        console.error("Failed to load resident-specific schedules", error)
        setNextScheduleText("내 칸 일정 없음")
      }
    }

    const loadGlobalSchedule = async () => {
      try {
        const schedule = await fetchNextInspectionSchedule()
        if (cancelled) return
        setNextScheduleText(formatScheduleSummary(schedule ?? null))
      } catch (error) {
        console.error("Failed to load global schedule", error)
        if (!cancelled) {
          setNextScheduleText("예정 없음")
        }
      }
    }

    if (restrictSlotViewToOwnership) {
      void loadResidentSchedule()
    } else {
      void loadGlobalSchedule()
    }

    return () => {
      cancelled = true
    }
  }, [restrictSlotViewToOwnership, ownedSlotIds, slots, permittedSlotIds, roomDetails])

  const filtered = useMemo(() => {
    const now = new Date()
    const today = new Date(now.toDateString()).getTime()
    const q = query.trim().toLowerCase()

    const matchesBaseFilters = (item: Item) => {
      if (selectedSlotId && item.slotId !== selectedSlotId) return false
      if (myOnly && !(uid ? item.ownerId === uid : item.owner === "me")) return false

      switch (tab) {
        case "mine":
          if (!(uid ? item.ownerId === uid : item.owner === "me")) return false
          break
        case "expiring": {
          const d = Math.floor((new Date(item.expiryDate).getTime() - today) / 86400000)
          if (!(d >= 0 && d <= 3)) return false
          break
        }
        case "expired": {
          const d = Math.floor((new Date(item.expiryDate).getTime() - today) / 86400000)
          if (d >= 0) return false
          break
        }
      }

      return true
    }

    const preliminary: Item[] = []
    const matchedBundles = new Set<string>()

    for (const item of items) {
      if (!matchesBaseFilters(item)) continue
      preliminary.push(item)

      if (!q) continue
      const haystack = `${item.bundleLabelDisplay ?? ""} ${item.bundleName ?? ""} ${item.name ?? ""}`.toLowerCase()
      if (haystack.includes(q)) {
        matchedBundles.add(item.bundleId)
      }
    }

    const result = preliminary.filter((item) => {
      if (!q) return true
      return matchedBundles.has(item.bundleId)
    })

    result.sort((a, b) => a.expiryDate.localeCompare(b.expiryDate))
    return result
  }, [items, query, tab, selectedSlotId, myOnly, uid])

  const counts = useMemo(() => {
    const now = new Date()
    let mine = 0,
      expiring = 0,
      expired = 0
    items.forEach((it) => {
      if (selectedSlotId && it.slotId !== selectedSlotId) return
      if (myOnly && !(uid ? it.ownerId === uid : it.owner === "me")) return
      const d = Math.floor((new Date(it.expiryDate).getTime() - new Date(now.toDateString()).getTime()) / 86400000)
      if (uid ? it.ownerId === uid : it.owner === "me") mine++
      if (d >= 0 && d <= 3) expiring++
      if (d < 0) expired++
    })
    return { mine, expiring, expired }
  }, [items, selectedSlotId, myOnly, uid])

  const selectedSlot = useMemo(() => slots.find((slot) => slot.slotId === selectedSlotId) ?? null, [slots, selectedSlotId])
  const selectedSlotSuspended = useMemo(() => {
    if (!selectedSlot) return false
    return selectedSlot.resourceStatus !== "ACTIVE" || Boolean(selectedSlot.locked)
  }, [selectedSlot])

  // Stable handlers
  const handleOpenItem = useCallback((id: string, opts?: { edit?: boolean }) => {
    setItemSheet({ open: true, id, edit: !!opts?.edit })
  }, [])
  const handleOpenBundle = useCallback((bid: string, opts?: { edit?: boolean }) => {
    setBundleSheet({ open: true, id: bid, edit: !!opts?.edit })
  }, [])

  const handleAddClick = useCallback(() => {
    const suspended = selectedSlot
      ? selectedSlot.resourceStatus !== "ACTIVE" || Boolean(selectedSlot.locked)
      : false
    if (suspended) {
      toast({
        title: "등록할 수 없습니다",
        description: "선택한 칸이 점검 중이거나 일시 중지되었습니다.",
        variant: "destructive",
      })
      return
    }
    setAddOpen(true)
  }, [selectedSlot, toast])

  return (
    <main className="min-h-[100svh] bg-white">
      <header className="sticky top-0 z-40 border-b bg-white/80 backdrop-blur">
        <div className="mx-auto max-w-screen-sm px-2 py-3 flex items-center">
          <div className="flex-1 text-center">
            <div className="inline-flex items-center gap-2">
              <Snowflake className="w-4 h-4 text-teal-700" />
              <h1 className="text-base font-semibold leading-none">{"냉장고"}</h1>
            </div>
          </div>
          <div className="inline-flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              aria-label="물품 등록"
              onClick={handleAddClick}
              aria-disabled={selectedSlotSuspended}
            >
              <Plus className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-screen-sm px-4 pb-28 pt-4 space-y-4">
        {initialLoadError && (
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="py-3 text-sm text-amber-800">{initialLoadError}</CardContent>
          </Card>
        )}
        <div>
          <div className="rounded-md border bg-slate-50 px-3 py-2.5 text-sm text-slate-700 flex items-center gap-2">
            <span className="font-medium">{"다음 점검일"}</span>
            <span className="text-slate-900 font-medium">{nextScheduleText}</span>
            <a
              href="/fridge/inspections"
              className="ml-auto inline-flex items-center rounded-md border bg-white px-2.5 py-1.5 text-xs font-medium text-slate-900 hover:bg-slate-100"
              aria-label="검사 일정 및 이력으로 이동"
            >
              {"검사 일정·이력"}
            </a>
          </div>
        </div>

        <Card className="mt-0">
          <CardContent className="py-3">
            <Filters
              active={tab}
              onChange={setTab}
              slotId={selectedSlotId}
              setSlotId={setSelectedSlotId}
              slots={visibleSlots}
              counts={counts}
              myOnly={myOnly}
              onToggleMyOnly={setMyOnly}
              searchValue={query}
              onSearchChange={setQuery}
              allowAllSlots={!restrictSlotViewToOwnership}
            />
          </CardContent>
        </Card>

        <section aria-labelledby="list-section">
          <h2 id="list-section" className="sr-only">
            {"목록"}
          </h2>
          {filtered.length === 0 ? (
            <Card>
              <CardContent className="py-6 text-center text-sm text-muted-foreground">
                {"조건에 해당하는 물품이 없습니다."}
              </CardContent>
            </Card>
          ) : (
            <ItemsList items={filtered} onOpenItem={handleOpenItem} onOpenBundle={handleOpenBundle} />
          )}
        </section>
      </div>

      <AddItemDialog open={addOpen} onOpenChange={setAddOpen} slots={visibleSlots} currentSlotId={selectedSlotId} />

      {/* Bottom sheets for quick detail (lazy-loaded) */}
      <ItemDetailSheet
        open={itemSheet.open}
        onOpenChange={(v) => setItemSheet((s) => ({ ...s, open: v }))}
        itemId={itemSheet.id}
        initialEdit={!!itemSheet.edit}
      />
      <BundleDetailSheet
        open={bundleSheet.open}
        onOpenChange={(v) => setBundleSheet((s) => ({ ...s, open: v }))}
        bundleId={bundleSheet.id}
        initialEdit={!!itemSheet.edit}
      />
    </main>
  )
}

const ROOMS_PER_FLOOR = 24

function computePermittedSlotIds({
  slots,
  roomDetails,
}: {
  slots: Slot[]
  roomDetails: RoomDetails
}): Set<string> {
  const permitted = new Set<string>()
  const floor = roomDetails.floor
  if (!floor) return permitted

  const floorSlots = slots.filter((slot) => slot.floorNo === floor)
  if (floorSlots.length === 0) {
    return permitted
  }

  const targetOrdinal = resolveRoomOrdinal(roomDetails)
  const chillSlots = floorSlots
    .filter((slot) => slot.compartmentType === "CHILL")
    .sort((a, b) => a.slotIndex - b.slotIndex)

  if (targetOrdinal && chillSlots.length > 0) {
    const baseChunk = Math.max(1, Math.floor(ROOMS_PER_FLOOR / chillSlots.length))
    const remainder = ROOMS_PER_FLOOR % chillSlots.length
    let start = 1
    chillSlots.forEach((slot, index) => {
      const bucketSize = baseChunk + (index < remainder ? 1 : 0)
      const end = start + bucketSize - 1
      if (targetOrdinal >= start && targetOrdinal <= end) {
        permitted.add(slot.slotId)
      }
      start = end + 1
    })
  }

  const freezeSlots = floorSlots.filter((slot) => slot.compartmentType === "FREEZE")
  freezeSlots.forEach((slot) => permitted.add(slot.slotId))

  if (permitted.size === 0) {
    chillSlots.forEach((slot) => permitted.add(slot.slotId))
    freezeSlots.forEach((slot) => permitted.add(slot.slotId))
  }

  return permitted
}

function normalizeRoomOrdinal(roomNumber?: string | number | null): number | null {
  if (!roomNumber) return null
  const digits = String(roomNumber).replace(/\D+/g, "")
  if (!digits) return null
  const numeric = Number.parseInt(digits, 10)
  if (!Number.isFinite(numeric)) return null
  const ordinal = numeric % 100
  if (ordinal <= 0) return null
  return ordinal
}

function resolveRoomOrdinal(roomDetails: RoomDetails): number | null {
  if (typeof roomDetails.personalNo === "number" && Number.isFinite(roomDetails.personalNo)) {
    return roomDetails.personalNo
  }
  if (roomDetails.roomNumber) {
    return normalizeRoomOrdinal(roomDetails.roomNumber)
  }
  return null
}

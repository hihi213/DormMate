"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import dynamic from "next/dynamic"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useFridge } from "@/features/fridge/hooks/fridge-context"
import type { Item } from "@/features/fridge/types"
import Filters from "@/features/fridge/components/filters"
import ItemsList from "@/features/fridge/components/items-list"
import BottomNav from "@/components/bottom-nav"
import { getCurrentUser, getCurrentUserId } from "@/lib/auth"
import AddItemDialog from "@/features/fridge/components/add-item-dialog"
import { formatKoreanDate } from "./utils-fridge-page"
import AuthGuard from "@/features/auth/components/auth-guard"
import { useToast } from "@/hooks/use-toast"
import { fetchNextInspectionSchedule, fetchInspectionSchedules } from "@/features/inspections/api"
import type { InspectionSchedule } from "@/features/inspections/types"
import type { Slot } from "@/features/fridge/types"
import UserServiceHeader from "@/app/_components/home/user-service-header"
import { useLogoutRedirect } from "@/hooks/use-logout-redirect"

// Lazy load heavier bottom sheets
const BundleDetailSheet = dynamic(() => import("@/features/fridge/components/bundle-detail-sheet"), { ssr: false })

export default function FridgePage() {
  return (
    <AuthGuard>
      <FridgeInner />
      <BottomNav />
    </AuthGuard>
  )
}

function FridgeInner() {
  const { items, slots, initialLoadError } = useFridge()
  const { toast } = useToast()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const currentUser = getCurrentUser()
  const isAdmin = currentUser?.roles.includes("ADMIN") ?? false
  const [mounted, setMounted] = useState(false)
  const [query, setQuery] = useState("")
  const [tab, setTab] = useState<"all" | "mine" | "expiring" | "expired">("all")
  const [selectedSlotId, setSelectedSlotId] = useState<string>("")
  const [addOpen, setAddOpen] = useState(false)
  const [nextScheduleText, setNextScheduleText] = useState<string>("")
  const [bundleSheet, setBundleSheet] = useState<{ open: boolean; id: string; edit?: boolean; unitId?: string | null }>({
    open: false,
    id: "",
    edit: false,
    unitId: null,
  })
  const uid = getCurrentUserId()
  const logoutAndRedirect = useLogoutRedirect()

  const restrictSlotViewToOwnership = !isAdmin

  const replaceQuery = useCallback(
    (mutation: (params: URLSearchParams) => void) => {
      if (!pathname) return
      const before = searchParams.toString()
      const params = new URLSearchParams(before)
      mutation(params)
      const next = params.toString()
      if (next === before) {
        return
      }
      router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false })
    },
    [pathname, router, searchParams],
  )

  useEffect(() => {
    const bundleParam = searchParams.get("bundle")
    const editParam = searchParams.get("bundleEdit") === "1"
    const bundleUnitParam = searchParams.get("bundleUnit")
    const itemParam = searchParams.get("item")
    const itemEditParam = searchParams.get("itemEdit") === "1"

    if (itemParam) {
      const target =
        items.find((candidate) => candidate.id === itemParam) ||
        items.find((candidate) => candidate.unitId === itemParam)
      if (!target) {
        return
      }
      setBundleSheet({ open: true, id: target.bundleId, edit: itemEditParam, unitId: target.unitId })
      replaceQuery((params) => {
        params.set("bundle", target.bundleId)
        if (itemEditParam) {
          params.set("bundleEdit", "1")
        } else {
          params.delete("bundleEdit")
        }
        params.set("bundleUnit", target.unitId)
        params.delete("item")
        params.delete("itemEdit")
      })
      return
    }

    if (bundleParam) {
      setBundleSheet({ open: true, id: bundleParam, edit: editParam, unitId: bundleUnitParam })
    } else {
      setBundleSheet((prev) => (prev.open ? { ...prev, open: false } : prev))
    }
  }, [items, replaceQuery, searchParams])

  const clearItemQuery = useCallback(() => {
    replaceQuery((params) => {
      params.delete("item")
      params.delete("itemEdit")
    })
  }, [replaceQuery])

  const clearBundleQuery = useCallback(() => {
    replaceQuery((params) => {
      params.delete("bundle")
      params.delete("bundleEdit")
      params.delete("bundleUnit")
    })
  }, [replaceQuery])

  const noAccessibleSlots = restrictSlotViewToOwnership && slots.length === 0

  useEffect(() => {
    if (!restrictSlotViewToOwnership) return
    if (slots.length === 0) return
    if (!selectedSlotId || !slots.some((slot) => slot.slotId === selectedSlotId)) {
      setSelectedSlotId(slots[0].slotId)
    }
  }, [restrictSlotViewToOwnership, slots, selectedSlotId])

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    let cancelled = false

    const formatScheduleSummary = (schedule: InspectionSchedule | null): string => {
      if (!schedule) return restrictSlotViewToOwnership ? "내 칸 일정 없음" : "예정 없음"
      return formatKoreanDate(new Date(schedule.scheduledAt))
    }

    const matchesResidentSlot = (
      schedule: InspectionSchedule,
      permittedIdsLocal: string[],
    ): boolean => {
      if (schedule.fridgeCompartmentId && permittedIdsLocal.includes(schedule.fridgeCompartmentId)) {
        return true
      }
      const byIndex =
        typeof schedule.slotIndex === "number"
          ? slots.find(
              (slot) =>
                slot.slotIndex === schedule.slotIndex &&
                (typeof schedule.floorNo === "number" ? slot.floorNo === schedule.floorNo : true),
            )
          : null
      if (byIndex) return true
      if (schedule.slotLetter) {
        const byLetter = slots.find(
          (slot) =>
            slot.slotLetter === schedule.slotLetter &&
            (typeof schedule.floorNo === "number" ? slot.floorNo === schedule.floorNo : true),
        )
        if (byLetter) return true
      }
      return false
    }

    const loadResidentSchedule = async () => {
      const permittedIds = slots.map((slot) => slot.slotId)
      if (permittedIds.length === 0) {
        setNextScheduleText("내 칸 일정 없음")
        return
      }
      try {
        const schedules = await fetchInspectionSchedules({
          status: "SCHEDULED",
          limit: Math.max(20, permittedIds.length * 2),
          compartmentIds: permittedIds,
        })
        if (cancelled) return
        const relevant = schedules
          .filter((schedule) => matchesResidentSlot(schedule, permittedIds))
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
  }, [restrictSlotViewToOwnership, slots])

  const filtered = useMemo(() => {
    const now = new Date()
    const today = new Date(now.toDateString()).getTime()
    const q = query.trim().toLowerCase()

    const matchesBaseFilters = (item: Item) => {
      if (selectedSlotId && item.slotId !== selectedSlotId) return false

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
  }, [items, query, tab, selectedSlotId, uid])

  const counts = useMemo(() => {
    const now = new Date()
    let mine = 0,
      expiring = 0,
      expired = 0
    items.forEach((it) => {
      if (selectedSlotId && it.slotId !== selectedSlotId) return
      const d = Math.floor((new Date(it.expiryDate).getTime() - new Date(now.toDateString()).getTime()) / 86400000)
      if (uid ? it.ownerId === uid : it.owner === "me") mine++
      if (d >= 0 && d <= 3) expiring++
      if (d < 0) expired++
    })
    return { mine, expiring, expired }
  }, [items, selectedSlotId, uid])

  const selectedSlot = useMemo(() => slots.find((slot) => slot.slotId === selectedSlotId) ?? null, [slots, selectedSlotId])
  const selectedSlotSuspended = useMemo(() => {
    if (!selectedSlot) return false
    return selectedSlot.resourceStatus !== "ACTIVE" || Boolean(selectedSlot.locked)
  }, [selectedSlot])

  // Stable handlers
  const handleOpenBundle = useCallback(
    (bid: string, opts?: { edit?: boolean; unitId?: string }) => {
      setBundleSheet({ open: true, id: bid, edit: !!opts?.edit, unitId: opts?.unitId ?? null })
      replaceQuery((params) => {
        params.set("bundle", bid)
        if (opts?.edit) {
          params.set("bundleEdit", "1")
        } else {
          params.delete("bundleEdit")
        }
        if (opts?.unitId) {
          params.set("bundleUnit", opts.unitId)
        } else {
          params.delete("bundleUnit")
        }
        params.delete("item")
        params.delete("itemEdit")
      })
    },
    [replaceQuery],
  )

  const handleAddClick = useCallback(() => {
    if (noAccessibleSlots) {
      toast({
        title: "등록할 수 없습니다",
        description: "배정된 냉장고 칸을 찾지 못했습니다. 관리자에게 칸 배정을 요청해 주세요.",
        variant: "destructive",
      })
      return
    }
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
  }, [noAccessibleSlots, selectedSlot, toast])

  return (
    <main className="min-h-[100svh] bg-white">
      <UserServiceHeader
        service="fridge"
        mounted={mounted}
        user={currentUser}
        isAdmin={isAdmin}
        onOpenInfo={() => toast({ title: "내 정보 화면은 아직 준비 중입니다." })}
        onLogout={() => {
          void logoutAndRedirect()
        }}
      />

      <div className="mx-auto max-w-screen-sm px-4 pb-28 pt-4 space-y-4">
        {initialLoadError && (
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="py-3 text-sm text-amber-800">{initialLoadError}</CardContent>
          </Card>
        )}
        {noAccessibleSlots && (
          <Card className="border-rose-200 bg-rose-50">
            <CardContent className="py-3 text-sm text-rose-700">
              {"현재 계정에 배정된 냉장고 칸이 없습니다. 데모 초기화 또는 칸 배정 상태를 확인해 주세요."}
            </CardContent>
          </Card>
        )}
        <div>
          <div className="rounded-md border bg-slate-50 px-3 py-2.5 text-sm text-slate-700 flex items-center gap-2">
            <span className="font-medium">{"다음 점검"}</span>
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
              slots={slots}
              counts={counts}
              searchValue={query}
              onSearchChange={setQuery}
              allowAllSlots={!restrictSlotViewToOwnership}
              actionSlot={
                <Button
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={handleAddClick}
                  disabled={noAccessibleSlots}
                >
                  {"물품 추가"}
                </Button>
              }
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
            <ItemsList items={filtered} onOpenBundle={handleOpenBundle} />
          )}
        </section>
      </div>

      <AddItemDialog open={addOpen} onOpenChange={setAddOpen} slots={slots} currentSlotId={selectedSlotId} />

      {/* Bottom sheets for quick detail (lazy-loaded) */}
      <BundleDetailSheet
        open={bundleSheet.open}
        onOpenChange={(v) => {
          setBundleSheet((s) => ({ ...s, open: v, unitId: v ? s.unitId : null, edit: v ? s.edit : false }))
          if (!v) {
            clearBundleQuery()
            clearItemQuery()
          }
        }}
        bundleId={bundleSheet.id}
        initialEdit={!!bundleSheet.edit}
        initialUnitId={bundleSheet.unitId ?? null}
      />
    </main>
  )
}

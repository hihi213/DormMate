"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import dynamic from "next/dynamic"
import { Snowflake, Plus } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { FridgeProvider, useFridge } from "@/components/fridge/fridge-context"
import Filters from "@/components/fridge/filters"
import ItemsList from "@/components/fridge/items-list"
import BottomNav from "@/components/bottom-nav"
import { getCurrentUserId } from "@/lib/auth"
import AddItemDialog from "@/components/fridge/add-item-dialog"
import { formatKoreanDate } from "./utils-fridge-page"
import AuthGuard from "@/components/auth-guard"

// Lazy load heavier bottom sheets
const ItemDetailSheet = dynamic(() => import("@/components/fridge/item-detail-sheet"), { ssr: false })
const BundleDetailSheet = dynamic(() => import("@/components/fridge/bundle-detail-sheet"), { ssr: false })

const SCHED_KEY = "fridge-inspections-schedule-v1"

type Schedule = { id: string; dateISO: string; title?: string; notes?: string }

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
  const { items, slots } = useFridge()
  const [query, setQuery] = useState("")
  const [tab, setTab] = useState<"all" | "mine" | "expiring" | "expired">("all")
  const [slotCode, setSlotCode] = useState<string>("")
  const [addOpen, setAddOpen] = useState(false)
  const [myOnly, setMyOnly] = useState(true)
  const [nextScheduleText, setNextScheduleText] = useState<string>("")
  const uid = getCurrentUserId()

  // Bottom Sheets state
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

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(SCHED_KEY) || "null") as Schedule[] | null
      if (Array.isArray(saved)) {
        const now = new Date()
        const upcoming = saved
          .map((s) => ({ ...s, d: new Date(s.dateISO) }))
          .filter((s) => s.d.getTime() >= now.getTime())
          .sort((a, b) => a.d.getTime() - b.d.getTime())[0]
        setNextScheduleText(upcoming ? formatKoreanDate(upcoming.d) : "예정 없음")
      } else setNextScheduleText("예정 없음")
    } catch {
      setNextScheduleText("예정 없음")
    }
  }, [])

  const filtered = useMemo(() => {
    const now = new Date()
    const q = query.trim().toLowerCase()
    return items
      .filter((it) => (slotCode ? it.slotCode === slotCode : true))
      .filter((it) => (myOnly ? (uid ? it.ownerId === uid : it.owner === "me") : true))
      .filter((it) => {
        if (!q) return true
        const hay = `${it.id} ${it.name} ${it.label}`.toLowerCase()
        return hay.includes(q)
      })
      .filter((it) => {
        if (tab === "all") return true
        if (tab === "mine") return uid ? it.ownerId === uid : it.owner === "me"
        const d = Math.floor((new Date(it.expiry).getTime() - new Date(now.toDateString()).getTime()) / 86400000)
        if (tab === "expiring") return d >= 0 && d <= 2
        if (tab === "expired") return d < 0
        return true
      })
      .sort((a, b) => a.expiry.localeCompare(b.expiry))
  }, [items, query, tab, slotCode, myOnly, uid])

  const counts = useMemo(() => {
    const now = new Date()
    let mine = 0,
      expiring = 0,
      expired = 0
    items.forEach((it) => {
      if (slotCode && it.slotCode !== slotCode) return
      if (myOnly && !(uid ? it.ownerId === uid : it.owner === "me")) return
      const d = Math.floor((new Date(it.expiry).getTime() - new Date(now.toDateString()).getTime()) / 86400000)
      if (uid ? it.ownerId === uid : it.owner === "me") mine++
      if (d >= 0 && d <= 2) expiring++
      if (d < 0) expired++
    })
    return { mine, expiring, expired }
  }, [items, slotCode, myOnly, uid])

  // Stable handlers
  const handleOpenItem = useCallback((id: string, opts?: { edit?: boolean }) => {
    setItemSheet({ open: true, id, edit: !!opts?.edit })
  }, [])
  const handleOpenBundle = useCallback((bid: string, opts?: { edit?: boolean }) => {
    setBundleSheet({ open: true, id: bid, edit: !!opts?.edit })
  }, [])

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
            <Button variant="ghost" size="icon" aria-label="물품 등록" onClick={() => setAddOpen(true)}>
              <Plus className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-screen-sm px-4 pb-28 pt-4">
        <div className="mb-3">
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
              slotCode={slotCode}
              setSlotCode={setSlotCode}
              slots={slots}
              counts={counts}
              myOnly={myOnly}
              onToggleMyOnly={setMyOnly}
              searchValue={query}
              onSearchChange={setQuery}
            />
          </CardContent>
        </Card>

        <section aria-labelledby="list-section" className="mt-4">
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

      <AddItemDialog open={addOpen} onOpenChange={setAddOpen} slots={slots} currentSlotCode={slotCode} />

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

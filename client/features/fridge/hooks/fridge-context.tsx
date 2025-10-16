"use client"

import type React from "react"
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"

import type {
  ActionResult,
  Bundle,
  Item,
  ItemPriority,
  ItemUnit,
  Slot,
} from "@/features/fridge/types"
import { useFridgeLogic } from "@/hooks/use-fridge-logic"
import { alphaFromOrder, createInitialData, formatBundleLabel, toItems } from "@/features/fridge/utils/data-shaping"
import { getCurrentUserId } from "@/lib/auth"

type AddBundlePayload = {
  slotCode: string
  bundleName: string
  memo?: string
  units: { name: string; expiry: string; quantity?: number; priority?: ItemPriority }[]
}

type UpdateItemPatch = Partial<Pick<Item, "name" | "expiry" | "memo" | "quantity" | "priority" | "status">> & {
  removedAt?: string | null
}

type FridgeContextValue = {
  slots: Slot[]
  bundles: Bundle[]
  units: ItemUnit[]
  items: Item[]
  isInspector: boolean
  lastInspectionAt: number
  logic: ReturnType<typeof useFridgeLogic>
  addBundle: (
    payload: AddBundlePayload,
  ) => ActionResult<{ bundleId: string; unitIds: string[]; bundle: Bundle; units: ItemUnit[] }>
  addSingleItem: (payload: {
    slotCode: string
    name: string
    expiry: string
    memo?: string
    quantity?: number
    priority?: ItemPriority
  }) => ActionResult<Item>
  updateItem: (unitId: string, patch: UpdateItemPatch) => ActionResult
  deleteItem: (unitId: string) => ActionResult
  setLastInspectionNow: () => void
  setInspector: (on: boolean) => void
  getSlotLabel: (slotCode: string) => string
  isSlotActive: (slotCode: string) => boolean
}

const FridgeContext = createContext<FridgeContextValue | null>(null)

export function FridgeProvider({ children }: { children: React.ReactNode }) {
  const currentUserId = getCurrentUserId() || undefined
  const { slots: initialSlots, bundles: initialBundles, units: initialUnits } = useMemo(
    () => createInitialData(currentUserId),
    [currentUserId],
  )

  const [slots, setSlots] = useState<Slot[]>(() => initialSlots)
  const [bundles, setBundles] = useState<Bundle[]>(() => initialBundles)
  const [units, setUnits] = useState<ItemUnit[]>(() => initialUnits)
  const [lastInspectionAt, setLastInspectionAt] = useState<number>(0)
  const [isInspector, setIsInspector] = useState(false)

  const items = useMemo(() => toItems(bundles, units), [bundles, units])

  const logic = useFridgeLogic(items, slots)

  useEffect(() => {
    const controller = new AbortController()
    fetch("/api/fridge/compartments?view=full", { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!Array.isArray(data)) return
        setSlots((prev) =>
          prev.map((slot) => {
            const meta = data.find((entry: any) => Number(entry?.id) === slot.resourceId) ?? null
            if (!meta) return slot
            const displayOrder =
              typeof meta.displayOrder === "number" && meta.displayOrder > 0
                ? meta.displayOrder
                : slot.displayOrder ?? undefined
            const computedCode = alphaFromOrder(displayOrder) || slot.code
            const labelRangeStart =
              typeof meta.labelRangeStart === "number" ? meta.labelRangeStart : slot.labelRangeStart
            const labelRangeEnd =
              typeof meta.labelRangeEnd === "number" ? meta.labelRangeEnd : slot.labelRangeEnd
            return {
              ...slot,
              resourceId: typeof meta.id === "number" ? meta.id : slot.resourceId,
              displayOrder,
              code: computedCode,
              labelRangeStart,
              labelRangeEnd,
              label: typeof meta.displayName === "string" ? meta.displayName : slot.label,
            }
          }),
        )
      })
      .catch((error) => {
        if (error.name !== "AbortError") {
          console.warn("Failed to load compartment metadata:", error)
        }
      })
    return () => controller.abort()
  }, [])

  const getSlotByCode = useCallback(
    (slotCode: string) => slots.find((slot) => slot.code === slotCode) ?? slots[0],
    [slots],
  )

  const issueBundleLabel = useCallback(
    (slotCode: string) => {
      const slot = getSlotByCode(slotCode)
      const existing = bundles.filter((bundle) => bundle.slotCode === slot.code).map((b) => b.labelNumber)
      const used = new Set(existing)
      const rangeStart = slot.labelRangeStart ?? 1
      const rangeEnd = slot.labelRangeEnd ?? Math.max(rangeStart, rangeStart + 998)

      let next = rangeStart
      while (next <= rangeEnd && used.has(next)) {
        next += 1
      }

      if (next > rangeEnd) {
        console.warn(`라벨 범위를 초과했습니다. slot=${slot.code}, range=${rangeStart}-${rangeEnd}`)
        next = rangeEnd
      }

      return { slot, labelNumber: next }
    },
    [bundles, getSlotByCode],
  )

  const addBundle = useCallback<FridgeContextValue["addBundle"]>(
    (payload) => {
      const { slot, labelNumber } = issueBundleLabel(payload.slotCode)
      const bundleId = crypto.randomUUID?.() ?? `bundle-${Date.now()}`
      const nowIso = new Date().toISOString()
      const ownerId = currentUserId
      const ownerUserId = ownerId ? Number(ownerId) : undefined
      const labelDisplay = formatBundleLabel(slot.code, labelNumber)

      const newBundle: Bundle = {
        bundleId,
        resourceId: slot.resourceId,
        slotCode: slot.code,
        labelNo: labelNumber,
        labelNumber,
        labelDisplay,
        bundleName: payload.bundleName,
        memo: payload.memo?.trim() || undefined,
        ownerUserId,
        ownerDisplayName: ownerId ? "나" : undefined,
        owner: ownerId ? "me" : "other",
        ownerId,
        createdAt: nowIso,
        updatedAt: nowIso,
      }

      const newUnits: ItemUnit[] = payload.units.map((unit, index) => ({
        unitId: crypto.randomUUID?.() ?? `unit-${bundleId}-${index}-${Date.now()}`,
        bundleId,
        seqNo: index + 1,
        name: unit.name.trim(),
        expiry: unit.expiry,
        quantity: unit.quantity,
        priority: unit.priority,
        memo: payload.memo?.trim() || undefined,
        createdAt: nowIso,
        updatedAt: nowIso,
      }))

      setBundles((prev) => [newBundle, ...prev])
      setUnits((prev) => [...newUnits, ...prev])

      return {
        success: true,
        data: { bundleId, unitIds: newUnits.map((u) => u.unitId), bundle: newBundle, units: newUnits },
        message: `${payload.bundleName} 묶음이 등록되었습니다.`,
      }
    },
    [bundles, units, currentUserId, issueBundleLabel],
  )

  const addSingleItem = useCallback<FridgeContextValue["addSingleItem"]>(
    (payload) => {
      const trimmedName = payload.name.trim()
      const result = addBundle({
        slotCode: payload.slotCode,
        bundleName: trimmedName || "무제 포장",
        memo: payload.memo,
        units: [
          {
            name: trimmedName || "무제 품목",
            expiry: payload.expiry,
            quantity: payload.quantity,
            priority: payload.priority,
          },
        ],
      })

      if (!result.success || !result.data) {
        return { success: false, error: result.error ?? "포장 등록에 실패했습니다." }
      }

      const bundle = result.data.bundle
      const createdUnit = result.data.units[0]
      const bundleLabelDisplay = formatBundleLabel(bundle.slotCode, bundle.labelNumber)
      const displayCode = `${bundleLabelDisplay}-${String(createdUnit.seqNo).padStart(2, "0")}`
      const newItem: Item = {
        id: displayCode,
        bundleId: bundle.bundleId,
        unitId: createdUnit.unitId,
        slotCode: bundle.slotCode,
        labelNo: bundle.labelNo,
        labelNumber: bundle.labelNumber,
        seqNo: createdUnit.seqNo,
        displayCode,
        bundleLabelDisplay: bundleLabelDisplay,
        bundleName: bundle.bundleName,
        name: createdUnit.name,
        expiry: createdUnit.expiry,
        memo: createdUnit.memo ?? bundle.memo,
        quantity: createdUnit.quantity,
        owner: bundle.owner,
        ownerId: bundle.ownerId,
        ownerUserId: bundle.ownerUserId,
        resourceId: bundle.resourceId,
        bundleMemo: bundle.memo,
        priority: createdUnit.priority,
        createdAt: createdUnit.createdAt,
        updatedAt: createdUnit.updatedAt,
      }

      return { success: true, data: newItem, message: "물품이 등록되었습니다." }
    },
    [addBundle],
  )

  const updateItem = useCallback<FridgeContextValue["updateItem"]>(
    (unitId, patch) => {
      try {
        const nowIso = new Date().toISOString()
        const targetUnit = units.find((unit) => unit.unitId === unitId)

        setUnits((prev) =>
          prev.map((unit) =>
            unit.unitId === unitId
              ? {
                  ...unit,
                  name: patch.name ?? unit.name,
                  expiry: patch.expiry ?? unit.expiry,
                  quantity: patch.quantity ?? unit.quantity,
                  memo: patch.memo ?? unit.memo,
                  priority: patch.priority ?? unit.priority,
                  removedAt: patch.removedAt === null ? undefined : patch.removedAt ?? unit.removedAt,
                  updatedAt: nowIso,
                }
              : unit,
          ),
        )

        if (patch.memo !== undefined && targetUnit) {
          const targetUnitsBundleId = targetUnit.bundleId
          if (targetUnitsBundleId) {
            setBundles((prev) =>
              prev.map((bundle) =>
                bundle.bundleId === targetUnitsBundleId
                  ? { ...bundle, memo: patch.memo ?? bundle.memo, updatedAt: nowIso }
                  : bundle,
              ),
            )
          }
        }

        return { success: true, message: "물품이 수정되었습니다." }
      } catch (error) {
        return {
          success: false,
          error: "물품 수정 중 오류가 발생했습니다.",
          message: error instanceof Error ? error.message : "알 수 없는 오류",
        }
      }
    },
    [units],
  )

  const deleteItem = useCallback<FridgeContextValue["deleteItem"]>(
    (unitId) => {
      try {
        const target = units.find((unit) => unit.unitId === unitId)
        if (!target) return { success: false, error: "대상 물품을 찾을 수 없습니다." }

        const remaining = units.filter((unit) => unit.bundleId === target.bundleId && unit.unitId !== unitId)

        setUnits((prev) => prev.filter((unit) => unit.unitId !== unitId))

        if (remaining.length === 0) {
          setBundles((prev) => prev.filter((bundle) => bundle.bundleId !== target.bundleId))
        }

        return { success: true, message: "물품이 삭제되었습니다." }
      } catch (error) {
        return {
          success: false,
          error: "물품 삭제 중 오류가 발생했습니다.",
          message: error instanceof Error ? error.message : "알 수 없는 오류",
        }
      }
    },
    [units],
  )

  const setLastInspectionNow = useCallback(() => {
    setLastInspectionAt(Date.now())
  }, [])

  const getSlotLabel = useCallback(
    (slotCode: string) => getSlotByCode(slotCode)?.label ?? slotCode,
    [getSlotByCode],
  )

  const isSlotActive = useCallback(
    (slotCode: string) => getSlotByCode(slotCode)?.isActive ?? false,
    [getSlotByCode],
  )

  const value = useMemo<FridgeContextValue>(
    () => ({
      slots,
      bundles,
      units,
      items,
      isInspector,
      lastInspectionAt,
      logic,
      addBundle,
      addSingleItem,
      updateItem,
      deleteItem,
      setLastInspectionNow,
      setInspector: setIsInspector,
      getSlotLabel,
      isSlotActive,
    }),
    [
      slots,
      bundles,
      units,
      items,
      isInspector,
      lastInspectionAt,
      logic,
      addBundle,
      addSingleItem,
      updateItem,
      deleteItem,
      setLastInspectionNow,
      getSlotLabel,
      isSlotActive,
    ],
  )

  return <FridgeContext.Provider value={value}>{children}</FridgeContext.Provider>
}

export function useFridge() {
  const ctx = useContext(FridgeContext)
  if (!ctx) throw new Error("useFridge must be used within FridgeProvider")
  return ctx
}

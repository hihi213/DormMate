"use client"

import type React from "react"
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"

import type {
  ActionResult,
  Bundle,
  Item,
  ItemUnit,
  Slot,
} from "@/features/fridge/types"
import { useFridgeLogic } from "@/hooks/use-fridge-logic"
import {
  fetchFridgeInventory,
  fetchFridgeSlots,
  createBundle as createBundleApi,
  updateBundle as updateBundleApi,
  updateItem as updateItemApi,
  deleteItem as deleteItemApi,
  deleteBundle as deleteBundleApi,
} from "@/features/fridge/api"
import { toItems } from "@/features/fridge/utils/data-shaping"
import {
  formatCompartmentLabel,
  formatSlotDisplayName,
  formatStickerLabel,
  formatStickerWithSequence,
} from "@/features/fridge/utils/labels"
import { getCurrentUser, getCurrentUserId } from "@/lib/auth"

type AddBundlePayload = {
  slotId: string
  bundleName: string
  memo?: string | null
  units: { name: string; expiryDate: string; quantity?: number; unitCode?: string | null }[]
}

type UpdateItemPatch = Partial<Pick<Item, "name" | "expiryDate" | "quantity" | "unitCode" | "freshness">> & {
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
  ) => Promise<ActionResult<{ bundleId: string; unitIds: string[]; bundle: Bundle; units: ItemUnit[] }>>
  addSingleItem: (payload: {
    slotId: string
    name: string
    expiryDate: string
    quantity?: number
    unitCode?: string | null
  }) => Promise<ActionResult<Item>>
  updateItem: (unitId: string, patch: UpdateItemPatch) => Promise<ActionResult>
  deleteItem: (unitId: string) => Promise<ActionResult>
  renameBundle: (bundleId: string, bundleName: string) => Promise<ActionResult<Bundle>>
  deleteBundle: (bundleId: string) => Promise<ActionResult>
  setLastInspectionNow: () => void
  setInspector: (on: boolean) => void
  getSlotLabel: (slotId: string, fallbackIndex?: number) => string
  isSlotActive: (slotId: string) => boolean
}

const FridgeContext = createContext<FridgeContextValue | null>(null)

type ErrorWithStatus = Error & { status?: number }

const isSuspendedError = (error: unknown): error is ErrorWithStatus =>
  error instanceof Error && (error as ErrorWithStatus).status === 423

const isCapacityError = (error: unknown): error is ErrorWithStatus & { code?: string } =>
  error instanceof Error && (error as ErrorWithStatus).status === 422

export function FridgeProvider({ children }: { children: React.ReactNode }) {
  const currentUserId = getCurrentUserId() || undefined

  const [slots, setSlots] = useState<Slot[]>([])
  const [bundleState, setBundleState] = useState<Bundle[]>([])
  const [units, setUnits] = useState<ItemUnit[]>([])
  const [lastInspectionAt, setLastInspectionAt] = useState<number>(0)
  const [isInspector, setIsInspector] = useState(false)

  useEffect(() => {
    let canceled = false

    const load = async () => {
      if (!currentUserId) {
        setSlots([])
        setBundleState([])
        setUnits([])
        return
      }

      const currentUser = getCurrentUser()
      const ownerScope = currentUser?.isAdmin ? "all" : "me"

      try {
        const [slotResult, inventoryResult] = await Promise.allSettled([
          fetchFridgeSlots(),
          fetchFridgeInventory(currentUserId, { ownerScope }),
        ])

        if (canceled) return

        if (slotResult.status === "fulfilled") {
          setSlots(slotResult.value)
        } else {
          console.error("Failed to load fridge slots", slotResult.reason)
          setSlots([])
        }

        if (inventoryResult.status === "fulfilled") {
          setBundleState(inventoryResult.value.bundles)
          setUnits(inventoryResult.value.units)
        } else {
          console.error("Failed to load fridge inventory", inventoryResult.reason)
          setBundleState([])
          setUnits([])
        }
      } catch (error) {
        if (canceled) return
        console.error("Unexpected fridge data load error", error)
        setSlots([])
        setBundleState([])
        setUnits([])
      }
    }

    void load()

    return () => {
      canceled = true
    }
  }, [currentUserId])

  const bundles = useMemo(() => bundleState, [bundleState])
  const items = useMemo(() => toItems(bundles, units), [bundles, units])
  const logic = useFridgeLogic(items, slots, currentUserId)

  const addBundle = useCallback<FridgeContextValue["addBundle"]>(
    async (payload) => {
      try {
        const normalizedUnits = payload.units.map((unit) => ({
          name: unit.name.trim(),
          expiryDate: unit.expiryDate,
          quantity: unit.quantity ?? 1,
          unitCode: unit.unitCode ?? null,
        }))

        const { bundle, units: createdUnits } = await createBundleApi(
          {
            slotId: payload.slotId,
            bundleName: payload.bundleName.trim(),
            memo: payload.memo?.trim() || undefined,
            units: normalizedUnits,
          },
          currentUserId,
        )

        setBundleState((prev) => [bundle, ...prev.filter((existing) => existing.bundleId !== bundle.bundleId)])
        setUnits((prev) => [...createdUnits, ...prev.filter((unit) => unit.bundleId !== bundle.bundleId)])

        return {
          success: true,
          data: {
            bundleId: bundle.bundleId,
            unitIds: createdUnits.map((u) => u.unitId),
            bundle,
            units: createdUnits,
          },
          message: `${bundle.bundleName} 묶음이 등록되었습니다.`,
        }
      } catch (error) {
        if (isSuspendedError(error)) {
          return {
            success: false,
            error: error.message || "선택한 칸이 점검 중이라 등록할 수 없습니다.",
            code: "COMPARTMENT_SUSPENDED",
          }
        }
        if (isCapacityError(error)) {
          const capacityMessage =
            (error as ErrorWithStatus & { code?: string }).code === "CAPACITY_EXCEEDED"
              ? "선택한 칸의 허용량을 초과했습니다. 다른 칸을 선택하거나 기존 포장을 정리해 주세요."
              : error.message || "포장 허용량을 초과했습니다."
          return {
            success: false,
            error: capacityMessage,
            code: "CAPACITY_EXCEEDED",
          }
        }
        return {
          success: false,
          error: error instanceof Error ? error.message : "포장을 등록하는 중 오류가 발생했습니다.",
        }
      }
    },
    [currentUserId],
  )

  const addSingleItem = useCallback<FridgeContextValue["addSingleItem"]>(
    async (payload) => {
      const trimmedName = payload.name.trim()
      const result = await addBundle({
        slotId: payload.slotId,
        bundleName: trimmedName || "무제 포장",
        units: [
          {
            name: trimmedName || "무제 품목",
            expiryDate: payload.expiryDate,
            quantity: payload.quantity,
            unitCode: payload.unitCode ?? null,
          },
        ],
      })

      if (!result.success || !result.data) {
        return { success: false, error: result.error ?? "포장 등록에 실패했습니다." }
      }

      const bundle = result.data.bundle
      const createdUnit = result.data.units[0]
      const bundleLabelDisplay =
        bundle.labelDisplay || formatStickerLabel(bundle.slotIndex, bundle.labelNumber)
      const displayLabel = formatStickerWithSequence(bundle.slotIndex, bundle.labelNumber, createdUnit.seqNo)
      const newItem: Item = {
        id: displayLabel,
        bundleId: bundle.bundleId,
        unitId: createdUnit.unitId,
        slotId: bundle.slotId,
        slotIndex: bundle.slotIndex,
        slotLetter: bundle.slotLetter,
        labelNumber: bundle.labelNumber,
        seqNo: createdUnit.seqNo,
        displayLabel,
        bundleLabelDisplay,
        bundleName: bundle.bundleName,
        name: createdUnit.name,
        expiryDate: createdUnit.expiryDate,
        unitCode: createdUnit.unitCode ?? null,
        lastInspectedAt: createdUnit.lastInspectedAt ?? null,
        updatedAfterInspection: createdUnit.updatedAfterInspection,
        memo: createdUnit.memo ?? bundle.memo ?? null,
        quantity: createdUnit.quantity ?? null,
        owner: bundle.owner,
        ownerId: bundle.ownerId,
        ownerUserId: bundle.ownerUserId ?? null,
        bundleMemo: bundle.memo ?? null,
        freshness: createdUnit.freshness ?? null,
        createdAt: createdUnit.createdAt,
        updatedAt: createdUnit.updatedAt,
        removedAt: createdUnit.removedAt ?? null,
      }

      return { success: true, data: newItem, message: "물품이 등록되었습니다." }
    },
    [addBundle],
  )

  const updateItem = useCallback<FridgeContextValue["updateItem"]>(
    async (unitId, patch) => {
      const targetUnit = units.find((unit) => unit.unitId === unitId)
      if (!targetUnit) {
        return { success: false, error: "대상 물품을 찾을 수 없습니다." }
      }

      const targetBundle = bundles.find((bundle) => bundle.bundleId === targetUnit.bundleId)
      if (!targetBundle) {
        return { success: false, error: "물품의 묶음 정보를 찾을 수 없습니다." }
      }

      try {
        const updatedUnit = await updateItemApi(
          unitId,
          {
            name: patch.name,
            expiryDate: patch.expiryDate,
            quantity: patch.quantity,
            unitCode: patch.unitCode ?? null,
            removedAt: patch.removedAt,
          },
          targetBundle,
        )

        setUnits((prev) =>
          prev.map((unit) =>
            unit.unitId === unitId
              ? {
                  ...unit,
                  name: updatedUnit.name,
                  expiryDate: updatedUnit.expiryDate,
                  quantity: updatedUnit.quantity ?? null,
                  unitCode: updatedUnit.unitCode ?? null,
                  freshness: updatedUnit.freshness ?? null,
                  lastInspectedAt: updatedUnit.lastInspectedAt ?? null,
                  updatedAfterInspection: updatedUnit.updatedAfterInspection,
                  updatedAt: updatedUnit.updatedAt,
                  removedAt: updatedUnit.removedAt ?? null,
                }
              : unit,
          ),
        )

        setBundleState((prev) =>
          prev.map((bundle) => {
            if (bundle.bundleId !== targetBundle.bundleId) {
              return bundle
            }
            return {
              ...bundle,
              updatedAt: updatedUnit.updatedAt,
            }
          }),
        )

        return { success: true, message: "물품이 수정되었습니다." }
      } catch (error) {
        if (isSuspendedError(error)) {
          return {
            success: false,
            error: error.message || "해당 칸이 점검 중이라 물품을 수정할 수 없습니다.",
            code: "COMPARTMENT_SUSPENDED",
          }
        }
        return {
          success: false,
          error: error instanceof Error ? error.message : "물품 수정 중 오류가 발생했습니다.",
        }
      }
    },
    [units, bundles],
  )

  const renameBundle = useCallback<FridgeContextValue["renameBundle"]>(
    async (bundleId, nextName) => {
      const trimmed = nextName.trim()
      if (!trimmed) {
        return { success: false, error: "대표명을 입력해 주세요." }
      }

      try {
        const { bundle, units: updatedUnits } = await updateBundleApi(
          bundleId,
          { bundleName: trimmed },
          currentUserId,
        )

        setBundleState((prev) => prev.map((existing) => (existing.bundleId === bundleId ? bundle : existing)))

        setUnits((prev) => {
          const updatedMap = new Map(updatedUnits.map((unit) => [unit.unitId, unit]))
          const seen = new Set<string>()
          const next = prev.map((unit) => {
            if (unit.bundleId !== bundleId) return unit
            const replacement = updatedMap.get(unit.unitId)
            if (replacement) {
              seen.add(unit.unitId)
              return replacement
            }
            return unit
          })
          updatedMap.forEach((unit, id) => {
            if (!seen.has(id)) {
              next.push(unit)
            }
          })
          return next
        })

        return {
          success: true,
          data: bundle,
          message: `${bundle.bundleName}으로 대표명이 변경되었습니다.`,
        }
      } catch (error) {
        if (isSuspendedError(error)) {
          return {
            success: false,
            error: error.message || "해당 칸이 점검 중이라 대표명을 수정할 수 없습니다.",
            code: "COMPARTMENT_SUSPENDED",
          }
        }
        return {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "포장 대표명을 수정하는 중 오류가 발생했습니다.",
        }
      }
    },
    [currentUserId],
  )

  const deleteItem = useCallback<FridgeContextValue["deleteItem"]>(
    async (unitId) => {
      const target = units.find((unit) => unit.unitId === unitId)
      if (!target) {
        return { success: false, error: "대상 물품을 찾을 수 없습니다." }
      }

      try {
        await deleteItemApi(unitId)

        const remaining = units.filter((unit) => unit.bundleId === target.bundleId && unit.unitId !== unitId)

        setUnits((prev) => prev.filter((unit) => unit.unitId !== unitId))

        if (remaining.length === 0) {
          setBundleState((prev) => prev.filter((bundle) => bundle.bundleId !== target.bundleId))
        } else {
          setBundleState((prev) =>
            prev.map((bundle) =>
              bundle.bundleId === target.bundleId
                ? { ...bundle, updatedAt: new Date().toISOString() }
                : bundle,
            ),
          )
        }

        return { success: true, message: "물품이 삭제되었습니다." }
      } catch (error) {
        if (isSuspendedError(error)) {
          return {
            success: false,
            error: error.message || "해당 칸이 점검 중이라 물품을 삭제할 수 없습니다.",
            code: "COMPARTMENT_SUSPENDED",
          }
        }
        return {
          success: false,
          error: error instanceof Error ? error.message : "물품 삭제 중 오류가 발생했습니다.",
        }
      }
    },
    [units],
  )

  const deleteBundle = useCallback<FridgeContextValue["deleteBundle"]>(
    async (bundleId) => {
      try {
        await deleteBundleApi(bundleId)
        setBundleState((prev) => prev.filter((bundle) => bundle.bundleId !== bundleId))
        setUnits((prev) => prev.filter((unit) => unit.bundleId !== bundleId))
        return { success: true, message: "묶음이 삭제되었습니다." }
      } catch (error) {
        if (isSuspendedError(error)) {
          return {
            success: false,
            error: error.message || "해당 칸이 점검 중이라 묶음을 삭제할 수 없습니다.",
            code: "COMPARTMENT_SUSPENDED",
          }
        }
        return {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "묶음을 삭제하는 중 오류가 발생했습니다.",
        }
      }
    },
    [],
  )

  const setLastInspectionNow = useCallback(() => {
    setLastInspectionAt(Date.now())
  }, [])

  const getSlotLabel = useCallback(
    (slotId: string, fallbackIndex?: number) => {
      const slot = slots.find((candidate) => candidate.slotId === slotId)
      if (slot) {
        return formatSlotDisplayName(slot)
      }
      if (typeof fallbackIndex === "number") {
        return formatCompartmentLabel(fallbackIndex)
      }
      return "?"
    },
    [slots],
  )

  const isSlotActive = useCallback(
    (slotId: string) => {
      const slot = slots.find((candidate) => candidate.slotId === slotId)
      if (!slot) return false
      return slot.resourceStatus === "ACTIVE" && !slot.locked
    },
    [slots],
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
      renameBundle,
      deleteBundle,
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
      renameBundle,
      deleteBundle,
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

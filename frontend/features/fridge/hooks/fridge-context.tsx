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
  initialLoadError: string | null
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
  updateBundleMeta: (
    bundleId: string,
    payload: { bundleName?: string; memo?: string | null },
  ) => Promise<ActionResult<Bundle>>
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

const SLOT_UNAVAILABLE_CODES = new Set(["COMPARTMENT_SUSPENDED", "COMPARTMENT_LOCKED", "COMPARTMENT_UNDER_INSPECTION"])
const isSystemCodeMessage = (value?: string) => !!value && /^[A-Z0-9_]+$/.test(value.trim())

type SlotRestrictionError = ErrorWithStatus & { code?: string; message?: string }

const resolveSlotUnavailableMessage = ({
  error,
  slot,
  actionClause,
  fallbackMessage,
}: {
  error?: SlotRestrictionError
  slot?: Slot | null
  actionClause: string
  fallbackMessage?: string
}): string => {
  const trimmedMessage = error?.message?.trim()
  const slotLabel = slot ? formatSlotDisplayName(slot) : "해당 칸"
  const fallback =
    fallbackMessage ?? `현재 ${slotLabel}을 사용할 수 없어 ${actionClause}`

  if (trimmedMessage && !SLOT_UNAVAILABLE_CODES.has(trimmedMessage) && !isSystemCodeMessage(trimmedMessage)) {
    return trimmedMessage
  }

  const derivedCode =
    error?.code ??
    (trimmedMessage && SLOT_UNAVAILABLE_CODES.has(trimmedMessage) ? trimmedMessage : undefined)

  switch (derivedCode) {
    case "COMPARTMENT_SUSPENDED":
      return `관리자 점검 중인 ${slotLabel}에서는 ${actionClause}`
    case "COMPARTMENT_LOCKED":
    case "COMPARTMENT_UNDER_INSPECTION":
      return `검사 중인 ${slotLabel}에서는 ${actionClause}`
    default:
      return fallback
  }
}

export function FridgeProvider({ children }: { children: React.ReactNode }) {
  const currentUserId = getCurrentUserId() || undefined

  const [slots, setSlots] = useState<Slot[]>([])
  const [bundleState, setBundleState] = useState<Bundle[]>([])
  const [units, setUnits] = useState<ItemUnit[]>([])
  const [lastInspectionAt, setLastInspectionAt] = useState<number>(0)
  const [isInspector, setIsInspector] = useState(false)
  const [initialLoadError, setInitialLoadError] = useState<string | null>(null)

  useEffect(() => {
    let canceled = false

    const load = async () => {
      setInitialLoadError(null)

      if (!currentUserId) {
        setSlots([])
        setBundleState([])
        setUnits([])
        setInitialLoadError(null)
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

        const deriveMessage = (reason: unknown): string => {
          const status =
            typeof reason === "object" && reason !== null && "status" in reason
              ? Number((reason as { status?: number }).status)
              : undefined
          if (status === 403) {
            return "냉장고 데이터를 볼 권한이 없습니다. 관리자에게 문의해 주세요."
          }
          if (status === 401) {
            return "세션이 만료되었습니다. 다시 로그인해 주세요."
          }
          if (reason instanceof Error && reason.message) {
            return reason.message
          }
          return "냉장고 데이터를 불러오지 못했습니다."
        }

        let loadError: string | null = null

        if (slotResult.status === "fulfilled") {
          setSlots(slotResult.value)
        } else {
          console.error("Failed to load fridge slots", slotResult.reason)
          setSlots([])
          loadError = deriveMessage(slotResult.reason)
        }

        if (inventoryResult.status === "fulfilled") {
          setBundleState(inventoryResult.value.bundles)
          setUnits(inventoryResult.value.units)
        } else {
          console.error("Failed to load fridge inventory", inventoryResult.reason)
          setBundleState([])
          setUnits([])
          loadError = loadError ?? deriveMessage(inventoryResult.reason)
        }

        setInitialLoadError(loadError)
      } catch (error) {
        if (canceled) return
        console.error("Unexpected fridge data load error", error)
        setSlots([])
        setBundleState([])
        setUnits([])
        setInitialLoadError("냉장고 데이터를 불러오지 못했습니다.")
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
        setSlots((prev) =>
          prev.map((slot) => {
            if (slot.slotId !== payload.slotId) {
              return slot
            }
            if (slot.capacity == null) {
              return slot
            }
            const nextCount = (slot.occupiedCount ?? 0) + 1
            return { ...slot, occupiedCount: nextCount }
          }),
        )

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
          const apiError = error as SlotRestrictionError
          const slotMeta = slots.find((slot) => slot.slotId === payload.slotId) ?? null
          const message = resolveSlotUnavailableMessage({
            error: apiError,
            slot: slotMeta,
            actionClause: "등록을 진행할 수 없습니다.",
            fallbackMessage: slotMeta
              ? `현재 ${formatSlotDisplayName(slotMeta)}을 사용할 수 없어 등록을 진행할 수 없습니다. 잠시 후 다시 시도해 주세요.`
              : "해당 칸을 사용할 수 없어 등록을 진행할 수 없습니다. 잠시 후 다시 시도해 주세요.",
          })
          return {
            success: false,
            error: message,
            code: apiError.code ?? "COMPARTMENT_SUSPENDED",
          }
        }
        if (isCapacityError(error)) {
          const apiError = error as ErrorWithStatus & { code?: string; message?: string }
          const slotMeta = slots.find((slot) => slot.slotId === payload.slotId)
          const slotLabel = slotMeta ? formatSlotDisplayName(slotMeta) : "선택한 칸"
          const capacity = slotMeta?.capacity
          const fallbackMessage = capacity
            ? `${slotLabel} 칸은 최대 ${capacity}개 포장을 보관할 수 있습니다. 기존 포장을 정리하거나 다른 칸을 선택해 주세요.`
            : `${slotLabel}의 허용량을 초과했습니다. 다른 칸을 선택하거나 기존 포장을 정리해 주세요.`
          const apiMessage = apiError.message && apiError.message !== "CAPACITY_EXCEEDED" ? apiError.message : undefined
          const capacityMessage = apiError.code === "CAPACITY_EXCEEDED" ? fallbackMessage : apiMessage ?? fallbackMessage
          return {
            success: false,
            error: capacityMessage,
            code: apiError.code ?? "CAPACITY_EXCEEDED",
          }
        }
        return {
          success: false,
          error: error instanceof Error ? error.message : "포장을 등록하는 중 오류가 발생했습니다.",
        }
      }
    },
    [currentUserId, slots],
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
          const apiError = error as SlotRestrictionError
          const slotMeta =
            slots.find((slot) => slot.slotId === targetBundle.slotId) ?? null
          const message = resolveSlotUnavailableMessage({
            error: apiError,
            slot: slotMeta,
            actionClause: "물품을 수정할 수 없습니다.",
          })
          return {
            success: false,
            error: message,
            code: apiError.code ?? "COMPARTMENT_SUSPENDED",
          }
        }
        return {
          success: false,
          error: error instanceof Error ? error.message : "물품 수정 중 오류가 발생했습니다.",
        }
      }
    },
    [units, bundles, slots],
  )

  const updateBundleMeta = useCallback<FridgeContextValue["updateBundleMeta"]>(
    async (bundleId, payload) => {
      const patch: { bundleName?: string; memo?: string | null } = {}
      if (payload.bundleName) {
        const trimmed = payload.bundleName.trim()
        if (!trimmed) {
          return { success: false, error: "대표명을 입력해 주세요." }
        }
        patch.bundleName = trimmed
      }
      if (payload.memo !== undefined) {
        patch.memo = payload.memo
      }

      if (Object.keys(patch).length === 0) {
        const existing = bundles.find((bundle) => bundle.bundleId === bundleId)
        return { success: true, data: existing ?? undefined }
      }

      const targetBundle = bundles.find((bundle) => bundle.bundleId === bundleId) ?? null

      try {
        const { bundle, units: updatedUnits } = await updateBundleApi(bundleId, patch, currentUserId)

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

        const pieces: string[] = []
        if (patch.bundleName) {
          pieces.push(`${bundle.bundleName}으로 대표명이 변경되었습니다.`)
        }
        if (patch.memo !== undefined) {
          pieces.push("대표 메모가 갱신되었습니다.")
        }

        return {
          success: true,
          data: bundle,
          message: pieces.join(" "),
        }
      } catch (error) {
        if (isSuspendedError(error)) {
          const apiError = error as SlotRestrictionError
          const slotMeta =
            targetBundle ? slots.find((slot) => slot.slotId === targetBundle.slotId) ?? null : null
          const actionClause =
            patch.bundleName && patch.memo !== undefined
              ? "대표명과 메모를 수정할 수 없습니다."
              : patch.memo !== undefined
                ? "대표 메모를 수정할 수 없습니다."
                : "대표명을 수정할 수 없습니다."
          const message = resolveSlotUnavailableMessage({
            error: apiError,
            slot: slotMeta,
            actionClause,
          })
          return {
            success: false,
            error: message,
            code: apiError.code ?? "COMPARTMENT_SUSPENDED",
          }
        }
        return {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "포장 정보를 수정하는 중 오류가 발생했습니다.",
        }
      }
    },
    [currentUserId, bundles, slots],
  )

  const deleteItem = useCallback<FridgeContextValue["deleteItem"]>(
    async (unitId) => {
      const target = units.find((unit) => unit.unitId === unitId)
      if (!target) {
        return { success: false, error: "대상 물품을 찾을 수 없습니다." }
      }

      const targetBundle = bundles.find((bundle) => bundle.bundleId === target.bundleId) ?? null
      const slotMeta =
        targetBundle ? slots.find((slot) => slot.slotId === targetBundle.slotId) ?? null : null

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
          const apiError = error as SlotRestrictionError
          const message = resolveSlotUnavailableMessage({
            error: apiError,
            slot: slotMeta,
            actionClause: "물품을 삭제할 수 없습니다.",
          })
          return {
            success: false,
            error: message,
            code: apiError.code ?? "COMPARTMENT_SUSPENDED",
          }
        }
        return {
          success: false,
          error: error instanceof Error ? error.message : "물품 삭제 중 오류가 발생했습니다.",
        }
      }
    },
    [units, bundles, slots],
  )

  const deleteBundle = useCallback<FridgeContextValue["deleteBundle"]>(
    async (bundleId) => {
      const targetBundle = bundles.find((bundle) => bundle.bundleId === bundleId) ?? null
      const slotMeta =
        targetBundle ? slots.find((slot) => slot.slotId === targetBundle.slotId) ?? null : null

      try {
        await deleteBundleApi(bundleId)
        setBundleState((prev) => prev.filter((bundle) => bundle.bundleId !== bundleId))
        setUnits((prev) => prev.filter((unit) => unit.bundleId !== bundleId))
        setSlots((prev) =>
          prev.map((slot) => {
            if (!targetBundle || slot.slotId !== targetBundle.slotId) {
              return slot
            }
            if (slot.capacity == null || slot.occupiedCount == null) {
              return slot
            }
            const next = Math.max(slot.occupiedCount - 1, 0)
            return { ...slot, occupiedCount: next }
          }),
        )
        return { success: true, message: "묶음이 삭제되었습니다." }
      } catch (error) {
        if (isSuspendedError(error)) {
          const apiError = error as SlotRestrictionError
          const message = resolveSlotUnavailableMessage({
            error: apiError,
            slot: slotMeta,
            actionClause: "묶음을 삭제할 수 없습니다.",
          })
          return {
            success: false,
            error: message,
            code: apiError.code ?? "COMPARTMENT_SUSPENDED",
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
    [bundles, slots],
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
      initialLoadError,
      isInspector,
      lastInspectionAt,
      logic,
      addBundle,
      addSingleItem,
      updateItem,
      deleteItem,
      updateBundleMeta,
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
      initialLoadError,
      isInspector,
      lastInspectionAt,
      logic,
      addBundle,
      addSingleItem,
      updateItem,
      deleteItem,
      updateBundleMeta,
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

import type {
  Bundle,
  FloorCode,
  Item,
  ItemPriority,
  ItemUnit,
  Owner,
  Slot,
} from "@/features/fridge/types"

export const FLOOR_CODES: FloorCode[] = ["2F", "3F", "4F", "5F"]

export function normalizeSlot(raw: any, index: number): Slot {
  const resourceId =
    typeof raw?.resourceId === "number" && !Number.isNaN(raw.resourceId) ? raw.resourceId : 2000 + index + 1
  const displayOrderCandidate =
    typeof raw?.displayOrder === "number" && raw.displayOrder > 0
      ? raw.displayOrder
      : typeof raw?.slotDisplayOrder === "number" && raw.slotDisplayOrder > 0
        ? raw.slotDisplayOrder
        : index + 1
  const displayOrder = Math.max(1, Math.floor(displayOrderCandidate))

  const labelRangeStartCandidate =
    typeof raw?.labelRangeStart === "number" && Number.isFinite(raw.labelRangeStart) ? raw.labelRangeStart : 1
  const labelRangeStart = Math.max(1, Math.floor(labelRangeStartCandidate))
  const labelRangeEndCandidate =
    typeof raw?.labelRangeEnd === "number" && Number.isFinite(raw.labelRangeEnd)
      ? raw.labelRangeEnd
      : labelRangeStart + 998
  const labelRangeEnd = Math.max(labelRangeStart, Math.floor(labelRangeEndCandidate))

  const providedDisplayCode =
    typeof raw?.displayCode === "string" && raw.displayCode.trim().length > 0 ? raw.displayCode.trim() : null
  const providedCode =
    typeof raw?.code === "string" && raw.code.trim().length > 0 ? raw.code.trim() : providedDisplayCode
  const code = providedCode || String(displayOrder) || `resource-${resourceId}`
  const label = typeof raw?.label === "string" && raw.label.trim().length > 0 ? raw.label : code
  const floorCode =
    typeof raw?.floorCode === "string" && FLOOR_CODES.includes(raw.floorCode as FloorCode)
      ? (raw.floorCode as FloorCode)
      : typeof raw?.floor === "number"
        ? `${raw.floor}F`
        : "2F"
  const type = raw?.type === "FRIDGE_COMP" ? raw.type : "FRIDGE_COMP"
  const status = raw?.status === "OUT_OF_SERVICE" ? "OUT_OF_SERVICE" : "ACTIVE"
  const createdAt =
    typeof raw?.createdAt === "string"
      ? raw.createdAt
      : typeof raw?.createdAt === "number"
        ? new Date(raw.createdAt).toISOString()
        : new Date().toISOString()
  const isActive = typeof raw?.isActive === "boolean" ? raw.isActive : status === "ACTIVE"
  const capacity =
    typeof raw?.capacity === "number" && !Number.isNaN(raw.capacity)
      ? raw.capacity
      : raw?.capacity == null
        ? null
        : Number(raw.capacity) || null
  const description = typeof raw?.description === "string" ? raw.description : undefined
  const temperature =
    raw?.temperature === "freezer" || raw?.temperature === "refrigerator" || raw?.temperature === "room"
      ? raw.temperature
      : undefined

  return {
    resourceId,
    code,
    displayOrder,
    labelRangeStart,
    labelRangeEnd,
    label,
    floorCode,
    type,
    status,
    createdAt,
    description,
    temperature,
    capacity,
    isActive,
  }
}

export const formatBundleLabel = (slotCode: string, labelNumber: number) =>
  `${slotCode}-${String(labelNumber).padStart(3, "0")}`

export function normalizeBundle(raw: any, slots: Slot[], index: number, currentUserId?: string): Bundle {
  const fallbackSlot = slots[0]
  const slot =
    typeof raw?.resourceId === "number"
      ? slots.find((s) => s.resourceId === raw.resourceId) ?? fallbackSlot
      : typeof raw?.slotCode === "string"
        ? slots.find((s) => s.code === raw.slotCode) ?? fallbackSlot
        : fallbackSlot

  if (!slot) throw new Error("Slot data required to normalise bundle.")

  const deriveLabelNumber = () => {
    if (typeof raw?.labelNumber === "number" && !Number.isNaN(raw.labelNumber)) return raw.labelNumber
    if (typeof raw?.labelNo === "number" && !Number.isNaN(raw.labelNo)) return raw.labelNo

    const displayCandidates = [raw?.labelDisplay, raw?.bundleLabelDisplay]

    for (const candidate of displayCandidates) {
      if (typeof candidate !== "string" || candidate.length === 0) continue
      const digits = candidate.replace(/[^0-9]/g, "")
      const parsed = Number(digits)
      if (!Number.isNaN(parsed) && parsed > 0) {
        return parsed
      }
    }

    return undefined
  }

  const rangeStart = slot.labelRangeStart ?? 1
  const rangeEnd = slot.labelRangeEnd ?? Math.max(rangeStart, rangeStart + 998)
  const fallbackFromIndex = rangeStart + index

  const labelNumberCandidate = deriveLabelNumber()
  const normalizedLabelNumber = (() => {
    if (typeof labelNumberCandidate === "number" && Number.isFinite(labelNumberCandidate)) {
      const floored = Math.floor(labelNumberCandidate)
      return Math.min(Math.max(floored, rangeStart), rangeEnd)
    }
    const flooredFallback = Math.floor(fallbackFromIndex)
    return Math.min(Math.max(flooredFallback, rangeStart), rangeEnd)
  })()

  const labelDisplay = formatBundleLabel(slot.code, normalizedLabelNumber)

  const createdAt =
    typeof raw?.createdAt === "string"
      ? raw.createdAt
      : typeof raw?.createdAt === "number"
        ? new Date(raw.createdAt).toISOString()
        : new Date().toISOString()
  const updatedAt =
    typeof raw?.updatedAt === "string"
      ? raw.updatedAt
      : typeof raw?.updatedAt === "number"
        ? new Date(raw.updatedAt).toISOString()
        : createdAt

  const ownerUserId =
    typeof raw?.ownerUserId === "number" && !Number.isNaN(raw.ownerUserId)
      ? raw.ownerUserId
      : typeof raw?.ownerId === "string" && raw.ownerId.length > 0
        ? Number(raw.ownerId)
        : undefined
  const ownerId = ownerUserId != null ? String(ownerUserId) : undefined

  const owner: Owner =
    raw?.owner === "me" || raw?.owner === "other"
      ? raw.owner
      : ownerId && currentUserId && ownerId === currentUserId
        ? "me"
        : undefined

  return {
    bundleId:
      typeof raw?.bundleId === "string" && raw.bundleId.length > 0
        ? raw.bundleId
        : crypto.randomUUID?.() ?? `bundle-${Date.now()}-${index}`,
    resourceId: slot.resourceId,
    slotCode: slot.code,
    labelNo: normalizedLabelNumber,
    labelNumber: normalizedLabelNumber,
    labelDisplay,
    bundleName: typeof raw?.bundleName === "string" && raw.bundleName.length > 0 ? raw.bundleName : "미지정 포장",
    memo: typeof raw?.memo === "string" ? raw.memo : undefined,
    ownerUserId,
    ownerDisplayName: typeof raw?.ownerDisplayName === "string" ? raw.ownerDisplayName : undefined,
    owner: owner ?? (currentUserId ? "me" : "other"),
    ownerId: ownerId ?? currentUserId,
    createdAt,
    updatedAt,
    removedAt:
      typeof raw?.removedAt === "string"
        ? raw.removedAt
        : typeof raw?.removedAt === "number"
          ? new Date(raw.removedAt).toISOString()
          : undefined,
  }
}

export function normalizeUnit(raw: any, bundle: Bundle, index: number): ItemUnit {
  const seqNo =
    typeof raw?.seqNo === "number" && raw.seqNo > 0 ? raw.seqNo : index + 1
  const createdAt =
    typeof raw?.createdAt === "string"
      ? raw.createdAt
      : typeof raw?.createdAt === "number"
        ? new Date(raw.createdAt).toISOString()
        : new Date().toISOString()
  const updatedAt =
    typeof raw?.updatedAt === "string"
      ? raw.updatedAt
      : typeof raw?.updatedAt === "number"
        ? new Date(raw.updatedAt).toISOString()
        : createdAt

  return {
    unitId:
      typeof raw?.unitId === "string" && raw.unitId.length > 0
        ? raw.unitId
        : crypto.randomUUID?.() ?? `unit-${bundle.bundleId}-${Date.now()}-${index}`,
    bundleId: bundle.bundleId,
    seqNo,
    name:
      typeof raw?.name === "string" && raw.name.length > 0 ? raw.name : `${bundle.bundleName} 세부 ${seqNo}`,
    expiry:
      typeof raw?.expiry === "string" && raw.expiry.length > 0
        ? raw.expiry
        : new Date().toISOString().slice(0, 10),
    quantity:
      typeof raw?.quantity === "number" && !Number.isNaN(raw.quantity) ? raw.quantity : undefined,
    memo: typeof raw?.memo === "string" ? raw.memo : undefined,
    priority:
      raw?.priority === "high" || raw?.priority === "medium" || raw?.priority === "low"
        ? raw.priority
        : undefined,
    createdAt,
    updatedAt,
    removedAt:
      typeof raw?.removedAt === "string"
        ? raw.removedAt
        : typeof raw?.removedAt === "number"
          ? new Date(raw.removedAt).toISOString()
          : undefined,
  }
}

export function toItems(bundles: Bundle[], units: ItemUnit[]): Item[] {
  return units.map((unit) => {
    const bundle = bundles.find((b) => b.bundleId === unit.bundleId)
    if (!bundle) throw new Error("Bundle not found for unit")
    const bundleLabel = formatBundleLabel(bundle.slotCode, bundle.labelNumber)
    const displayCode = `${bundleLabel}-${String(unit.seqNo).padStart(2, "0")}`
    return {
      id: displayCode,
      bundleId: bundle.bundleId,
      unitId: unit.unitId,
      slotCode: bundle.slotCode,
      resourceId: bundle.resourceId,
      labelNo: bundle.labelNo,
      labelNumber: bundle.labelNumber,
      seqNo: unit.seqNo,
      displayCode,
      bundleLabelDisplay: bundleLabel,
      bundleName: bundle.bundleName,
      name: unit.name,
      expiry: unit.expiry,
      memo: unit.memo ?? bundle.memo,
      quantity: unit.quantity,
      owner: bundle.owner,
      ownerId: bundle.ownerId,
      ownerUserId: bundle.ownerUserId,
      bundleMemo: bundle.memo,
      priority: unit.priority,
      createdAt: unit.createdAt,
      updatedAt: unit.updatedAt,
      removedAt: unit.removedAt,
    }
  })
}

export function createInitialSlots(): Slot[] {
  return []
}

export function createInitialData() {
  const slots: Slot[] = []
  const bundles: Bundle[] = []
  const units: ItemUnit[] = []
  const items: Item[] = []

  return { slots, bundles, units, items }
}

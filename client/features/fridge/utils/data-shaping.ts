import type {
  Bundle,
  FloorCode,
  Item,
  ItemPriority,
  ItemUnit,
  Owner,
  Slot,
} from "@/features/fridge/types"
import { addDays, startOfDayLocal, toYMD } from "@/lib/date-utils"

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

  let ownerId: string | undefined
  let ownerUserId: number | undefined

  if (typeof raw?.ownerId === "string" && raw.ownerId.trim().length > 0) {
    ownerId = raw.ownerId.trim()
    const numericCandidate = Number(ownerId)
    if (!Number.isNaN(numericCandidate) && Number.isFinite(numericCandidate)) {
      ownerUserId = numericCandidate
    }
  } else if (typeof raw?.ownerUserId === "number" && !Number.isNaN(raw.ownerUserId)) {
    ownerUserId = raw.ownerUserId
    ownerId = String(raw.ownerUserId)
  }

  const owner: Owner =
    raw?.owner === "me" || raw?.owner === "other"
      ? raw.owner
      : ownerId && currentUserId && ownerId === currentUserId
        ? "me"
        : ownerId
          ? "other"
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
    owner: owner ?? "other",
    ownerId,
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

export const FRIDGE_SLOTS_KEY = "fridge-slots-v1"
export const FRIDGE_BUNDLES_KEY = "fridge-bundles-v1"
export const FRIDGE_UNITS_KEY = "fridge-units-v1"

type FridgeSeed = {
  slots: Slot[]
  bundles: Bundle[]
  units: ItemUnit[]
}

export function generateDefaultFridgeData(): FridgeSeed {
  const today = startOfDayLocal(new Date())
  const createdAt = addDays(today, -3).toISOString()

  const slots: Slot[] = [
    {
      resourceId: 2001,
      code: "2F-A",
      displayOrder: 1,
      labelRangeStart: 1,
      labelRangeEnd: 60,
      label: "2층 냉장 A",
      floorCode: "2F",
      type: "FRIDGE_COMP",
      status: "ACTIVE",
      createdAt,
      description: "2층 거주자 공용 냉장고 A",
      temperature: "refrigerator",
      capacity: 24,
      isActive: true,
    },
    {
      resourceId: 2002,
      code: "2F-B",
      displayOrder: 2,
      labelRangeStart: 1,
      labelRangeEnd: 60,
      label: "2층 냉장 B",
      floorCode: "2F",
      type: "FRIDGE_COMP",
      status: "ACTIVE",
      createdAt,
      description: "2층 거주자 공용 냉장고 B",
      temperature: "refrigerator",
      capacity: 24,
      isActive: true,
    },
    {
      resourceId: 2003,
      code: "2F-F",
      displayOrder: 3,
      labelRangeStart: 1,
      labelRangeEnd: 40,
      label: "2층 냉동실",
      floorCode: "2F",
      type: "FRIDGE_COMP",
      status: "ACTIVE",
      createdAt,
      description: "2층 공용 냉동실",
      temperature: "freezer",
      capacity: 20,
      isActive: true,
    },
  ]

  const bundles: Bundle[] = [
    {
      bundleId: "seed-alice-001",
      resourceId: slots[0].resourceId,
      slotCode: slots[0].code,
      labelNo: 1,
      labelNumber: 1,
      labelDisplay: formatBundleLabel(slots[0].code, 1),
      bundleName: "주간 식재료",
      memo: "우유는 3일 내 소비",
      owner: "other",
      ownerId: "alice",
      ownerDisplayName: "김도미",
      createdAt,
      updatedAt: createdAt,
    },
    {
      bundleId: "seed-bob-001",
      resourceId: slots[1].resourceId,
      slotCode: slots[1].code,
      labelNo: 5,
      labelNumber: 5,
      labelDisplay: formatBundleLabel(slots[1].code, 5),
      bundleName: "김치 보관",
      memo: "김치 단지",
      owner: "other",
      ownerId: "bob",
      ownerDisplayName: "박태일",
      createdAt,
      updatedAt: createdAt,
    },
    {
      bundleId: "seed-charlie-frozen",
      resourceId: slots[2].resourceId,
      slotCode: slots[2].code,
      labelNo: 3,
      labelNumber: 3,
      labelDisplay: formatBundleLabel(slots[2].code, 3),
      bundleName: "동결 만두",
      memo: "야식용",
      owner: "other",
      ownerId: "charlie",
      ownerDisplayName: "최나래",
      createdAt,
      updatedAt: createdAt,
    },
    {
      bundleId: "seed-alice-expired",
      resourceId: slots[0].resourceId,
      slotCode: slots[0].code,
      labelNo: 8,
      labelNumber: 8,
      labelDisplay: formatBundleLabel(slots[0].code, 8),
      bundleName: "간식 보관",
      memo: "유통기한 확인 필요",
      owner: "other",
      ownerId: "alice",
      ownerDisplayName: "김도미",
      createdAt,
      updatedAt: createdAt,
    },
  ]

  const units: ItemUnit[] = [
    {
      unitId: "seed-unit-1001",
      bundleId: "seed-alice-001",
      seqNo: 1,
      name: "우유",
      expiry: toYMD(addDays(today, 5)),
      quantity: 1,
      createdAt,
      updatedAt: createdAt,
    },
    {
      unitId: "seed-unit-1002",
      bundleId: "seed-alice-001",
      seqNo: 2,
      name: "계란",
      expiry: toYMD(addDays(today, 2)),
      quantity: 10,
      createdAt,
      updatedAt: createdAt,
    },
    {
      unitId: "seed-unit-1010",
      bundleId: "seed-bob-001",
      seqNo: 1,
      name: "김치",
      expiry: toYMD(addDays(today, 7)),
      quantity: 1,
      createdAt,
      updatedAt: createdAt,
    },
    {
      unitId: "seed-unit-1020",
      bundleId: "seed-charlie-frozen",
      seqNo: 1,
      name: "갈비만두",
      expiry: toYMD(addDays(today, 30)),
      quantity: 1,
      createdAt,
      updatedAt: createdAt,
    },
    {
      unitId: "seed-unit-1030",
      bundleId: "seed-alice-expired",
      seqNo: 1,
      name: "요거트",
      expiry: toYMD(addDays(today, -1)),
      quantity: 2,
      createdAt,
      updatedAt: createdAt,
    },
  ]

  return { slots, bundles, units }
}

export function createInitialData() {
  const base = generateDefaultFridgeData()
  return { ...base, items: toItems(base.bundles, base.units) }
}

export function loadFridgeDataFromStorage(): FridgeSeed | null {
  if (typeof window === "undefined") return null

  let slots: Slot[] | null = null
  let bundles: Bundle[] | null = null
  let units: ItemUnit[] | null = null

  try {
    const rawSlots = JSON.parse(localStorage.getItem(FRIDGE_SLOTS_KEY) || "null")
    if (Array.isArray(rawSlots) && rawSlots.length) {
      slots = rawSlots.map((slot: any, index: number) => normalizeSlot(slot, index))
    }
  } catch {
    slots = null
  }

  if (!slots) return null

  try {
    const rawBundles = JSON.parse(localStorage.getItem(FRIDGE_BUNDLES_KEY) || "null")
    if (Array.isArray(rawBundles) && rawBundles.length) {
      bundles = rawBundles.map((bundle: any, index: number) => normalizeBundle(bundle, slots!, index))
    }
  } catch {
    bundles = null
  }

  if (!bundles) return null

  try {
    const rawUnits = JSON.parse(localStorage.getItem(FRIDGE_UNITS_KEY) || "null")
    if (Array.isArray(rawUnits) && rawUnits.length) {
      const normalizedUnits: ItemUnit[] = []
      rawUnits.forEach((unit: any, index: number) => {
        const parentBundle = bundles!.find((bundle) => bundle.bundleId === unit?.bundleId)
        if (!parentBundle) return
        normalizedUnits.push(normalizeUnit(unit, parentBundle, index))
      })
      if (normalizedUnits.length) {
        units = normalizedUnits
      }
    }
  } catch {
    units = null
  }

  if (!units) return null

  return { slots, bundles, units }
}

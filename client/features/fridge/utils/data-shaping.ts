import type {
  Bundle,
  FloorCode,
  Item,
  ItemPriority,
  ItemUnit,
  Owner,
  Slot,
} from "@/features/fridge/types"

export const alphaFromOrder = (order: number | undefined): string => {
  if (!order || order < 1) return "";
  let n = order
  let result = ""
  while (n > 0) {
    const idx = (n - 1) % 26
    result = String.fromCharCode(65 + idx) + result
    n = Math.floor((n - 1) / 26)
  }
  return result
}

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
  const code = providedCode || alphaFromOrder(displayOrder) || `resource-${resourceId}`
  const label = typeof raw?.label === "string" && raw.label.trim().length > 0 ? raw.label : code
  const floorCode =
    typeof raw?.floorCode === "string" && FLOOR_CODES.includes(raw.floorCode as FloorCode)
      ? (raw.floorCode as FloorCode)
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
  const baseSlots: Partial<Slot>[] = [
    {
      resourceId: 2101,
      displayOrder: 1,
      labelRangeStart: 1,
      labelRangeEnd: 999,
      label: "2층 냉장 1칸",
      floorCode: "2F",
      description: "과일과 채소를 보관하는 칸",
      temperature: "refrigerator",
      capacity: 10,
      isActive: true,
    },
    {
      resourceId: 2102,
      displayOrder: 2,
      labelRangeStart: 1,
      labelRangeEnd: 999,
      label: "2층 냉장 2칸",
      floorCode: "2F",
      description: "반찬 및 조리 음식을 보관하는 칸",
      temperature: "refrigerator",
      capacity: 15,
      isActive: true,
    },
    {
      resourceId: 2103,
      displayOrder: 3,
      labelRangeStart: 1,
      labelRangeEnd: 999,
      label: "2층 냉동 칸",
      floorCode: "2F",
      description: "냉동 보관이 필요한 음식",
      temperature: "freezer",
      capacity: 20,
      isActive: true,
    },
    {
      resourceId: 3101,
      displayOrder: 1,
      labelRangeStart: 1,
      labelRangeEnd: 999,
      label: "3층 냉장 1칸",
      floorCode: "3F",
      description: "3층 학생 전용 칸",
      temperature: "refrigerator",
      capacity: 12,
      isActive: true,
    },
  ]

  return baseSlots.map((slot, index) => normalizeSlot(slot, index))
}

export function createInitialData(currentUserId?: string) {
  const slots = createInitialSlots()

  const bundleSources = [
    { slotIndex: 0, bundleName: "사과 묶음", labelNo: 1, memo: "공용 과일" },
    { slotIndex: 0, bundleName: "김치 용기", labelNo: 2, memo: "3층 학생 전용" },
    { slotIndex: 1, bundleName: "만두팩", labelNo: 1 },
  ]

  const bundles = bundleSources.map((source, index) => {
    const slot = slots[source.slotIndex] ?? slots[0]
    const raw = {
      slotCode: slot.code,
      bundleName: source.bundleName,
      labelNo: source.labelNo,
      memo: source.memo,
      resourceId: slot.resourceId,
      labelNumber: source.labelNo,
    }
    return normalizeBundle(raw, slots, index, currentUserId)
  })

  const units: ItemUnit[] = []

  bundles.forEach((bundle, index) => {
    if (bundle.bundleName.includes("사과")) {
      units.push(
        normalizeUnit(
          {
            name: "부사",
            seqNo: 1,
            expiry: futureDate(5),
            quantity: 3,
            priority: "medium" as ItemPriority,
          },
          bundle,
          units.length,
        ),
      )
      units.push(
        normalizeUnit(
          {
            name: "홍옥",
            seqNo: 2,
            expiry: futureDate(1),
            quantity: 2,
            priority: "high" as ItemPriority,
          },
          bundle,
          units.length,
        ),
      )
    } else if (bundle.bundleName.includes("김치")) {
      units.push(
        normalizeUnit(
          {
            name: "배추 김치",
            seqNo: 1,
            expiry: futureDate(14),
            quantity: 1,
          },
          bundle,
          units.length,
        ),
      )
      units.push(
        normalizeUnit(
          {
            name: "깍두기",
            seqNo: 2,
            expiry: futureDate(10),
            quantity: 1,
          },
          bundle,
          units.length,
        ),
      )
    } else {
      units.push(
        normalizeUnit(
          {
            name: "고기만두",
            seqNo: 1,
            expiry: futureDate(20),
            quantity: 1,
          },
          bundle,
          units.length,
        ),
      )
    }
  })

  const items = toItems(bundles, units)

  return { slots, bundles, units, items }
}

function futureDate(days: number) {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

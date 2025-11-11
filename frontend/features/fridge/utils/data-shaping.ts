import type {
  Bundle,
  CompartmentType,
  FloorCode,
  Item,
  ItemPriority,
  ItemUnit,
  Owner,
  ResourceStatus,
  Slot,
} from "@/features/fridge/types"

const SLOT_RADIX = 26

export const toSlotLetter = (slotIndex: number): string => {
  if (slotIndex < 0 || Number.isNaN(slotIndex)) {
    return "?"
  }
  let value = slotIndex
  if (!Number.isInteger(value)) {
    value = Math.floor(value)
  }
  const builder: string[] = []
  while (value >= 0) {
    const remainder = value % SLOT_RADIX
    builder.push(String.fromCharCode("A".charCodeAt(0) + remainder))
    value = Math.floor(value / SLOT_RADIX) - 1
  }
  return builder.reverse().join("")
}

export const formatLabelNumber = (labelNumber: number): string => {
  if (!labelNumber || labelNumber <= 0) {
    return "000"
  }
  const safeValue = Math.min(labelNumber, 999)
  return String(safeValue).padStart(3, "0")
}

export const formatBundleLabel = (slotIndex: number, labelNumber: number): string =>
  `${toSlotLetter(slotIndex)}${formatLabelNumber(labelNumber)}`

export type FridgeSlotDto = {
  slotId: string
  slotIndex: number
  slotLetter?: string | null
  floorNo: number
  floorCode: string
  compartmentType: CompartmentType
  resourceStatus: ResourceStatus
  locked: boolean
  lockedUntil?: string | null
  capacity?: number | null
  displayName?: string | null
  occupiedCount?: number | null
}

export type FridgeBundleSummaryDto = {
  bundleId: string
  slotId: string
  slotIndex: number
  slotLabel?: string | null
  labelNumber?: number | null
  labelDisplay?: string | null
  bundleName: string
  memo?: string | null
  ownerUserId?: string | null
  ownerDisplayName?: string | null
  ownerRoomNumber?: string | null
  status: string
  freshness?: string | null
  itemCount: number
  createdAt: string
  updatedAt: string
  removedAt?: string | null
  items?: FridgeItemDto[] | null
}

export type FridgeItemDto = {
  itemId: string
  bundleId: string
  name: string
  expiryDate: string
  quantity?: number | null
  unitCode?: string | null
  freshness?: string | null
  lastInspectedAt?: string | null
  updatedAfterInspection: boolean
  priority?: ItemPriority | null
  memo?: string | null
  createdAt: string
  updatedAt: string
  removedAt?: string | null
}

export type FridgeBundleDto = FridgeBundleSummaryDto & {
  items: FridgeItemDto[]
}

export type BundleListResponseDto = {
  items: FridgeBundleSummaryDto[]
  totalCount: number
}

export type FridgeSlotListResponseDto = {
  items: FridgeSlotDto[]
  totalCount: number
  page?: number
  size?: number
  totalPages?: number
}

export function mapSlotFromDto(dto: FridgeSlotDto): Slot {
  const slotLetter = dto.slotLetter && dto.slotLetter.length > 0 ? dto.slotLetter : toSlotLetter(dto.slotIndex)
  return {
    slotId: dto.slotId,
    slotIndex: dto.slotIndex,
    slotLetter,
    floorNo: dto.floorNo,
    floorCode: dto.floorCode as FloorCode,
    compartmentType: dto.compartmentType,
    resourceStatus: dto.resourceStatus,
    locked: dto.locked,
    lockedUntil: dto.lockedUntil ?? null,
    capacity: dto.capacity ?? null,
    displayName: dto.displayName ?? null,
    occupiedCount: dto.occupiedCount ?? null,
  }
}

export function mapBundleFromDto(
  dto: FridgeBundleDto,
  currentUserId?: string,
): { bundle: Bundle; units: ItemUnit[] } {
  const slotIndex = dto.slotIndex ?? 0
  const labelNumber = dto.labelNumber ?? 0
  const slotLetter = dto.slotLabel && dto.slotLabel.length > 0 ? dto.slotLabel : toSlotLetter(slotIndex)
  const labelDisplay = dto.labelDisplay ?? formatBundleLabel(slotIndex, labelNumber)
  const ownerUserId = dto.ownerUserId ?? null
  const owner: Owner =
    ownerUserId && currentUserId && ownerUserId === currentUserId ? "me" : "other"

  const bundle: Bundle = {
    bundleId: dto.bundleId,
    slotId: dto.slotId,
    slotIndex,
    slotLetter,
    labelNumber,
    labelDisplay,
    bundleName: dto.bundleName,
    memo: dto.memo ?? null,
    ownerUserId,
    ownerDisplayName: dto.ownerDisplayName ?? null,
    ownerRoomNumber: dto.ownerRoomNumber ?? null,
    owner,
    ownerId: ownerUserId ?? undefined,
    status: (dto.status?.toUpperCase() as Bundle["status"]) ?? "ACTIVE",
    freshness: dto.freshness ?? null,
    itemCount: dto.itemCount,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
    removedAt: dto.removedAt ?? null,
  }

  const unitSource = Array.isArray(dto.items) ? dto.items : []
  const units = unitSource.map((item, index) => mapItemFromDto(item, bundle, index))

  return { bundle, units }
}

export function mapItemFromDto(item: FridgeItemDto, bundle: Bundle, index: number): ItemUnit {
  const seqNo = index + 1
  return {
    unitId: item.itemId,
    bundleId: bundle.bundleId,
    seqNo,
    name: item.name,
    expiryDate: item.expiryDate,
    quantity: item.quantity ?? null,
    unitCode: item.unitCode ?? null,
    freshness: item.freshness ?? null,
    lastInspectedAt: item.lastInspectedAt ?? null,
    updatedAfterInspection: Boolean(item.updatedAfterInspection),
    memo: item.memo ?? null,
    priority: item.priority ?? undefined,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    removedAt: item.removedAt ?? null,
  }
}

export type FridgeItemResponseDto = FridgeItemDto

export function mapItemFromResponse(dto: FridgeItemResponseDto, bundle: Bundle): ItemUnit {
  return mapItemFromDto(dto, bundle, 0)
}

export function toItems(bundles: Bundle[], units: ItemUnit[]): Item[] {
  return units.map((unit) => {
    const bundle = bundles.find((b) => b.bundleId === unit.bundleId)
    if (!bundle) {
      throw new Error(`Bundle not found for unit ${unit.unitId}`)
    }
    const bundleLabel = bundle.labelDisplay || formatBundleLabel(bundle.slotIndex, bundle.labelNumber)
    const displayLabel = `${bundleLabel}-${String(unit.seqNo).padStart(2, "0")}`
    return {
      id: displayLabel,
      bundleId: bundle.bundleId,
      unitId: unit.unitId,
      slotId: bundle.slotId,
      slotIndex: bundle.slotIndex,
      slotLetter: bundle.slotLetter,
      labelNumber: bundle.labelNumber,
      seqNo: unit.seqNo,
      displayLabel,
      bundleLabelDisplay: bundleLabel,
      bundleName: bundle.bundleName,
      name: unit.name,
      expiryDate: unit.expiryDate,
      unitCode: unit.unitCode ?? null,
      updatedAfterInspection: unit.updatedAfterInspection,
      lastInspectedAt: unit.lastInspectedAt ?? null,
      memo: unit.memo ?? bundle.memo ?? null,
      quantity: unit.quantity ?? null,
      owner: bundle.owner,
      ownerId: bundle.ownerId,
      ownerUserId: bundle.ownerUserId ?? null,
      ownerDisplayName: bundle.ownerDisplayName ?? null,
      ownerRoomNumber: bundle.ownerRoomNumber ?? null,
      bundleMemo: bundle.memo ?? null,
      freshness: unit.freshness ?? null,
      priority: unit.priority,
      createdAt: unit.createdAt,
      updatedAt: unit.updatedAt,
      removedAt: unit.removedAt ?? null,
    }
  })
}

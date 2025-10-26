import type {
  Bundle,
  FloorCode,
  Item,
  ItemPriority,
  ItemUnit,
  Owner,
  ResourceStatus,
  ResourceType,
  Slot,
} from "@/features/fridge/types"

export type FridgeSlotDto = {
  slotId: string
  slotCode: string
  floor: number
  floorCode: string
  type: ResourceType
  status: ResourceStatus
  labelRangeStart?: number | null
  labelRangeEnd?: number | null
  capacity?: number | null
  temperature?: string | null
  displayOrder?: number | null
  displayName?: string | null
  isActive: boolean
}

export type FridgeBundleSummaryDto = {
  bundleId: string
  slotId?: string | null
  slotCode: string
  labelNo: number
  labelDisplay?: string | null
  bundleName: string
  memo?: string | null
  ownerUserId?: string | null
  ownerDisplayName?: string | null
  ownerRoomNumber?: string | null
  status: string
  itemCount: number
  createdAt: string
  updatedAt: string
  removedAt?: string | null
}

export type FridgeItemDto = {
  itemId: string
  bundleId: string
  sequenceNo: number
  name: string
  expiryDate: string
  quantity?: number | null
  unit?: string | null
  status: string
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

export const formatBundleLabel = (slotCode: string, labelNumber: number) =>
  `${slotCode}-${String(labelNumber).padStart(3, "0")}`

export function mapSlotFromDto(dto: FridgeSlotDto): Slot {
  const label = dto.displayName && dto.displayName.trim().length > 0 ? dto.displayName : dto.slotCode
  return {
    slotId: dto.slotId,
    code: dto.slotCode,
    displayOrder: dto.displayOrder ?? null,
    labelRangeStart: dto.labelRangeStart ?? null,
    labelRangeEnd: dto.labelRangeEnd ?? null,
    label,
    floor: dto.floor,
    floorCode: dto.floorCode as FloorCode,
    type: dto.type,
    status: dto.status,
    temperature: dto.temperature ?? null,
    capacity: dto.capacity ?? null,
    isActive: dto.isActive,
  }
}

export function mapBundleFromDto(
  dto: FridgeBundleDto,
  currentUserId?: string,
): { bundle: Bundle; units: ItemUnit[] } {
  const labelNumber = dto.labelNo
  const labelDisplay = dto.labelDisplay ?? formatBundleLabel(dto.slotCode, labelNumber)
  const ownerUserId = dto.ownerUserId ?? null
  const owner: Owner =
    ownerUserId && currentUserId && ownerUserId === currentUserId ? "me" : "other"

  const bundle: Bundle = {
    bundleId: dto.bundleId,
    slotId: dto.slotId ?? undefined,
    slotCode: dto.slotCode,
    labelNo: labelNumber,
    labelNumber,
    labelDisplay,
    bundleName: dto.bundleName,
    memo: dto.memo ?? null,
    ownerUserId,
    ownerDisplayName: dto.ownerDisplayName ?? null,
    ownerRoomNumber: dto.ownerRoomNumber ?? null,
    owner,
    ownerId: ownerUserId ?? undefined,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
    removedAt: dto.removedAt ?? null,
  }

  const units = dto.items.map((item, index) => mapItemFromDto(item, bundle, index))

  return { bundle, units }
}

export function mapItemFromDto(item: FridgeItemDto, bundle: Bundle, index: number): ItemUnit {
  const seqNo = typeof item.sequenceNo === "number" && item.sequenceNo > 0 ? item.sequenceNo : index + 1
  return {
    unitId: item.itemId,
    bundleId: bundle.bundleId,
    seqNo,
    name: item.name,
    expiry: item.expiryDate,
    quantity: item.quantity ?? null,
    memo: item.memo ?? null,
    priority: item.priority ?? undefined,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    removedAt: item.removedAt ?? null,
  }
}

export type FridgeItemResponseDto = FridgeItemDto

export function mapItemFromResponse(
  dto: FridgeItemResponseDto,
  bundle: Bundle,
): ItemUnit {
  const index = typeof dto.sequenceNo === "number" && dto.sequenceNo > 0 ? dto.sequenceNo - 1 : 0
  return mapItemFromDto(dto, bundle, index)
}

export function toItems(bundles: Bundle[], units: ItemUnit[]): Item[] {
  return units.map((unit) => {
    const bundle = bundles.find((b) => b.bundleId === unit.bundleId)
    if (!bundle) {
      throw new Error(`Bundle not found for unit ${unit.unitId}`)
    }
    const bundleLabel = bundle.labelDisplay || formatBundleLabel(bundle.slotCode, bundle.labelNumber)
    const displayCode = `${bundleLabel}-${String(unit.seqNo).padStart(2, "0")}`
    return {
      id: displayCode,
      bundleId: bundle.bundleId,
      unitId: unit.unitId,
      slotCode: bundle.slotCode,
      slotId: bundle.slotId,
      labelNo: bundle.labelNo,
      labelNumber: bundle.labelNumber,
      seqNo: unit.seqNo,
      displayCode,
      bundleLabelDisplay: bundleLabel,
      bundleName: bundle.bundleName,
      name: unit.name,
      expiry: unit.expiry,
      memo: unit.memo ?? bundle.memo ?? null,
      quantity: unit.quantity ?? null,
      owner: bundle.owner,
      ownerId: bundle.ownerId,
      ownerUserId: bundle.ownerUserId ?? null,
      bundleMemo: bundle.memo ?? null,
      status: undefined,
      priority: unit.priority,
      createdAt: unit.createdAt,
      updatedAt: unit.updatedAt,
      removedAt: unit.removedAt ?? null,
    }
  })
}

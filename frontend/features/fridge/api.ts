import { safeApiCall } from "@/lib/api-client"
import type { Bundle, ItemPriority, ItemUnit, Slot } from "@/features/fridge/types"
import {
  BundleListResponseDto,
  FridgeBundleDto,
  FridgeItemResponseDto,
  FridgeSlotDto,
  mapBundleFromDto,
  mapItemFromResponse,
  mapSlotFromDto,
} from "@/features/fridge/utils/data-shaping"

export async function fetchFridgeSlots(): Promise<Slot[]> {
  const search = new URLSearchParams({ view: "full", size: "200" })
  const { data, error } = await safeApiCall<FridgeSlotDto[]>(`/fridge/slots?${search.toString()}`, {
    method: "GET",
  })

  if (error || !data) {
    throw new Error(error?.message ?? "냉장고 칸 정보를 불러오지 못했습니다.")
  }

  return data.map(mapSlotFromDto)
}

type InventoryFetchOptions = {
  ownerScope?: "all" | "me"
}

export async function fetchFridgeInventory(
  currentUserId?: string,
  options: InventoryFetchOptions = {},
): Promise<{ bundles: Bundle[]; units: ItemUnit[] }> {
  const search = new URLSearchParams({
    status: "active",
    size: "200",
  })

  if (options.ownerScope === "all") {
    search.set("owner", "all")
  }

  const { data, error } = await safeApiCall<BundleListResponseDto>(`/fridge/bundles?${search.toString()}`, {
    method: "GET",
  })

  if (error || !data) {
    throw new Error(error?.message ?? "포장 목록을 불러오지 못했습니다.")
  }

  const summaries = data.items ?? []
  if (summaries.length === 0) {
    return { bundles: [], units: [] }
  }

  const detailResults = await Promise.all(
    summaries.map((summary) =>
      safeApiCall<FridgeBundleDto>(`/fridge/bundles/${summary.bundleId}`, {
        method: "GET",
      }),
    ),
  )

  const bundles: Bundle[] = []
  const units: ItemUnit[] = []

  detailResults.forEach((result, index) => {
    if (result.error || !result.data) {
      const fallbackId = summaries[index]?.bundleId
      const message = result.error?.message ?? "포장 상세 정보를 불러오지 못했습니다."
      throw new Error(fallbackId ? `${message} (bundleId=${fallbackId})` : message)
    }
    const { bundle, units: mappedUnits } = mapBundleFromDto(result.data, currentUserId)
    bundles.push(bundle)
    units.push(...mappedUnits)
  })

  return { bundles, units }
}

type CreateBundleUnitInput = {
  name: string
  expiry: string
  quantity?: number
  priority?: ItemPriority
  memo?: string
}

export type CreateBundlePayload = {
  slotCode: string
  bundleName: string
  memo?: string
  units: CreateBundleUnitInput[]
}

type CreateBundleResponseDto = {
  bundle: FridgeBundleDto
}

const normalizeDate = (value: string) => (value?.length ? value.slice(0, 10) : value)
const normalizePriority = (priority?: ItemPriority | null) => priority?.toUpperCase()

export async function createBundle(
  payload: CreateBundlePayload,
  currentUserId?: string,
): Promise<{ bundle: Bundle; units: ItemUnit[] }> {
  const body = {
    slotCode: payload.slotCode,
    bundleName: payload.bundleName,
    memo: payload.memo ?? undefined,
    items: payload.units.map((unit) => ({
      name: unit.name,
      expiryDate: normalizeDate(unit.expiry),
      quantity: unit.quantity ?? 1,
      priority: normalizePriority(unit.priority),
      memo: unit.memo ?? undefined,
    })),
  }

  const { data, error } = await safeApiCall<CreateBundleResponseDto>("/fridge/bundles", {
    method: "POST",
    body,
  })

  if (error || !data) {
    throw new Error(error?.message ?? "포장을 등록하지 못했습니다.")
  }

  return mapBundleFromDto(data.bundle, currentUserId)
}

type UpdateBundlePayload = {
  bundleName?: string
  memo?: string | null
  removedAt?: string | null
}

type UpdateBundleResponseDto = FridgeBundleDto

export async function updateBundle(
  bundleId: string,
  payload: UpdateBundlePayload,
  currentUserId?: string,
): Promise<{ bundle: Bundle; units: ItemUnit[] }> {
  const body = {
    bundleName: payload.bundleName?.trim(),
    memo: payload.memo ?? null,
    removedAt: payload.removedAt ?? null,
  }

  const { data, error } = await safeApiCall<UpdateBundleResponseDto>(`/fridge/bundles/${bundleId}`, {
    method: "PATCH",
    body,
  })

  if (error || !data) {
    throw new Error(error?.message ?? "포장 정보를 수정하지 못했습니다.")
  }

  return mapBundleFromDto(data, currentUserId)
}

export type UpdateItemPayload = {
  name?: string
  expiry?: string
  quantity?: number
  priority?: ItemPriority
  memo?: string
  removedAt?: string | null
}

export async function updateItem(
  itemId: string,
  payload: UpdateItemPayload,
  bundle: Bundle,
): Promise<ItemUnit> {
  const body = {
    name: payload.name?.trim(),
    expiryDate: payload.expiry ? normalizeDate(payload.expiry) : undefined,
    quantity: payload.quantity,
    priority: normalizePriority(payload.priority),
    memo: payload.memo ?? undefined,
    removedAt: payload.removedAt ?? undefined,
  }

  const { data, error } = await safeApiCall<FridgeItemResponseDto>(`/fridge/items/${itemId}`, {
    method: "PATCH",
    body,
  })

  if (error || !data) {
    throw new Error(error?.message ?? "물품 정보를 수정하지 못했습니다.")
  }

  return mapItemFromResponse(data, bundle)
}

export async function deleteItem(itemId: string): Promise<void> {
  const { error } = await safeApiCall<unknown>(`/fridge/items/${itemId}`, {
    method: "DELETE",
    parseResponseAs: "none",
  })

  if (error) {
    throw new Error(error.message ?? "물품을 삭제하지 못했습니다.")
  }
}

export async function deleteBundle(bundleId: string): Promise<void> {
  const { error } = await safeApiCall<unknown>(`/fridge/bundles/${bundleId}`, {
    method: "DELETE",
    parseResponseAs: "none",
  })

  if (error) {
    throw new Error(error.message ?? "포장을 삭제하지 못했습니다.")
  }
}

import { safeApiCall } from "@/lib/api-client"
import type { Bundle, ItemUnit, Slot } from "@/features/fridge/types"
import {
  BundleListResponseDto,
  FridgeBundleDto,
  FridgeSlotDto,
  mapBundleFromDto,
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

export async function fetchFridgeInventory(
  currentUserId?: string,
): Promise<{ bundles: Bundle[]; units: ItemUnit[] }> {
  const search = new URLSearchParams({
    owner: "all",
    status: "active",
    size: "200",
  })

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

  detailResults.forEach((result) => {
    if (!result.ok || !result.data) {
      throw new Error(result.error?.message ?? "포장 상세 정보를 불러오지 못했습니다.")
    }
    const { bundle, units: mappedUnits } = mapBundleFromDto(result.data, currentUserId)
    bundles.push(bundle)
    units.push(...mappedUnits)
  })

  return { bundles, units }
}


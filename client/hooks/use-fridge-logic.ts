import { useMemo, useCallback } from "react"
import type { Item, Slot, FilterOptions, FridgeStats, ItemStatus } from "@/components/fridge/types"
import { daysLeft } from "@/lib/date-utils"

export function useFridgeLogic(items: Item[], slots: Slot[]) {
  // 아이템 상태 계산
  const getItemStatus = useCallback((expiry: string): ItemStatus => {
    const days = daysLeft(expiry)
    if (days < 0) return "expired"
    if (days <= 2) return "expiring"
    return "ok"
  }, [])

  // 아이템에 상태 추가
  const itemsWithStatus = useMemo(() => {
    return items.map(item => ({
      ...item,
      status: getItemStatus(item.expiry)
    }))
  }, [items, getItemStatus])

  // 필터링된 아이템
  const getFilteredItems = useCallback((options: FilterOptions) => {
    let filtered = [...itemsWithStatus]

    // 탭별 필터링
    switch (options.tab) {
      case "mine":
        filtered = filtered.filter(item => item.owner === "me")
        break
      case "expiring":
        filtered = filtered.filter(item => item.status === "expiring")
        break
      case "expired":
        filtered = filtered.filter(item => item.status === "expired")
        break
    }

    // 칸별 필터링
    if (options.slotCode) {
      filtered = filtered.filter(item => item.slotCode === options.slotCode)
    }

    // 검색어 필터링
    if (options.searchQuery) {
      const query = options.searchQuery.trim().toLowerCase()
      filtered = filtered.filter(item => 
        item.name.toLowerCase().includes(query) ||
        item.label.toLowerCase().includes(query) ||
        (item.memo && item.memo.toLowerCase().includes(query))
      )
    }

    // 내 물품만 필터링
    if (options.myOnly) {
      filtered = filtered.filter(item => item.owner === "me")
    }

    // 정렬
    filtered.sort((a, b) => {
      let aValue: string | number
      let bValue: string | number

      switch (options.sortBy) {
        case "expiry":
          aValue = new Date(a.expiry).getTime()
          bValue = new Date(b.expiry).getTime()
          break
        case "name":
          aValue = a.name.toLowerCase()
          bValue = b.name.toLowerCase()
          break
        case "createdAt":
          aValue = a.createdAt
          bValue = b.createdAt
          break
        default:
          aValue = new Date(a.expiry).getTime()
          bValue = new Date(b.expiry).getTime()
      }

      if (options.sortOrder === "desc") {
        [aValue, bValue] = [bValue, aValue]
      }

      if (typeof aValue === "string") {
        return aValue.localeCompare(bValue as string)
      }
      return aValue - bValue
    })

    return filtered
  }, [itemsWithStatus])

  // 통계 계산
  const getStats = useCallback((): FridgeStats => {
    const stats: FridgeStats = {
      totalItems: items.length,
      myItems: items.filter(item => item.owner === "me").length,
      expiringItems: itemsWithStatus.filter(item => item.status === "expiring").length,
      expiredItems: itemsWithStatus.filter(item => item.status === "expired").length,
      bySlot: {},
      byStatus: { ok: 0, expiring: 0, expired: 0 }
    }

    // 칸별 개수
    items.forEach(item => {
      stats.bySlot[item.slotCode] = (stats.bySlot[item.slotCode] || 0) + 1
    })

    // 상태별 개수
    itemsWithStatus.forEach(item => {
      if (item.status) {
        stats.byStatus[item.status]++
      }
    })

    return stats
  }, [items, itemsWithStatus])

  // 묶음 그룹화
  const getBundles = useCallback(() => {
    const bundles = new Map<string, Item[]>()
    
    itemsWithStatus.forEach(item => {
      if (item.groupCode) {
        if (!bundles.has(item.groupCode)) {
          bundles.set(item.groupCode, [])
        }
        bundles.get(item.groupCode)!.push(item)
      }
    })

    return Array.from(bundles.entries()).map(([code, items]) => ({
      code,
      items,
      name: getBundleName(items[0]?.name || ""),
      slotCode: items[0]?.slotCode || "",
      earliestExpiry: items.reduce((earliest, item) => 
        new Date(item.expiry) < new Date(earliest) ? item.expiry : earliest
      , items[0]?.expiry || "")
    }))
  }, [itemsWithStatus])

  // 묶음 이름 추출
  const getBundleName = useCallback((name: string) => {
    const idx = name.indexOf(" - ")
    return idx >= 0 ? name.slice(0, idx) : name
  }, [])

  // 상세 이름 추출
  const getDetailName = useCallback((name: string, bundleName: string) => {
    const prefix = `${bundleName} - `
    return name.startsWith(prefix) ? name.slice(prefix.length) : name
  }, [])

  // 다음 ID 생성
  const getNextId = useCallback((slotCode: string) => {
    const existingIds = items
      .filter(item => item.slotCode === slotCode)
      .map(item => {
        const numPart = item.id.replace(slotCode, "")
        return parseInt(numPart, 10)
      })
      .filter(num => !isNaN(num))

    const nextNum = existingIds.length > 0 ? Math.max(...existingIds) + 1 : 1
    return `${slotCode}${String(nextNum).padStart(3, "0")}`
  }, [items])

  // 유통기한 경고 아이템
  const getExpiringItems = useCallback((daysThreshold = 2) => {
    return itemsWithStatus.filter(item => {
      const days = daysLeft(item.expiry)
      return days >= 0 && days <= daysThreshold
    })
  }, [itemsWithStatus])

  // 만료된 아이템
  const getExpiredItems = useCallback(() => {
    return itemsWithStatus.filter(item => item.status === "expired")
  }, [itemsWithStatus])

  return {
    itemsWithStatus,
    getFilteredItems,
    getStats,
    getBundles,
    getBundleName,
    getDetailName,
    getNextId,
    getExpiringItems,
    getExpiredItems,
    getItemStatus
  }
}

import { useMemo, useCallback, useRef, useState } from "react"
import { useFridge } from "@/features/fridge/hooks/fridge-context"
import type { Item, FilterOptions, ItemPriority } from "@/features/fridge/types"
import { resolveStatus } from "@/lib/fridge-logic"
import { daysLeft } from "@/lib/date-utils"

export function useFilteredItems(filters: FilterOptions) {
  const { items } = useFridge()

  return useMemo(() => {
    const query = filters.searchQuery?.trim().toLowerCase() ?? ""

    const matchesBaseFilters = (item: Item) => {
      if (filters.slotId && item.slotId !== filters.slotId) return false
      if (typeof filters.slotIndex === "number" && item.resourceId !== filters.slotIndex) return false

      switch (filters.tab) {
        case "mine":
          if (item.owner !== "me") return false
          break
        case "expiring":
          if (resolveStatus(item.expiryDate) !== "expiring") return false
          break
        case "expired":
          if (resolveStatus(item.expiryDate) !== "expired") return false
          break
        default:
          break
      }

      if (filters.myOnly && item.owner !== "me") return false
      return true
    }

    const preliminary: Item[] = []
    const matchedBundles = new Set<string>()

    for (const item of items) {
      if (!matchesBaseFilters(item)) continue
      preliminary.push(item)

      if (!query) continue
      const haystack = `${item.bundleLabelDisplay ?? ""} ${item.bundleName ?? ""} ${item.name ?? ""}`.toLowerCase()
      if (haystack.includes(query)) {
        matchedBundles.add(item.bundleId)
      }
    }

    const filtered = preliminary.filter((item) => {
      if (!query) return true
      return matchedBundles.has(item.bundleId)
    })

    filtered.sort((a, b) => {
      let aValue: string | number = 0
      let bValue: string | number = 0

      switch (filters.sortBy) {
        case "name":
          aValue = a.name.toLowerCase()
          bValue = b.name.toLowerCase()
          break
        case "createdAt":
          aValue = new Date(a.createdAt).getTime()
          bValue = new Date(b.createdAt).getTime()
          break
        case "expiryDate":
        default:
          aValue = new Date(a.expiryDate).getTime()
          bValue = new Date(b.expiryDate).getTime()
          break
      }

      if (filters.sortOrder === "desc") {
        [aValue, bValue] = [bValue, aValue]
      }

      if (typeof aValue === "string") {
        return aValue.localeCompare(bValue as string)
      }
      return (aValue as number) - (bValue as number)
    })

    return filtered
  }, [items, filters])
}

export function useFridgeStats() {
  const { items } = useFridge()

  return useMemo(() => {
    const total = items.length
    const expired = items.filter((item) => resolveStatus(item.expiryDate) === "expired").length
    const expiringSoon = items.filter((item) => resolveStatus(item.expiryDate) === "expiring").length
    const fresh = items.filter((item) => resolveStatus(item.expiryDate) === "ok").length

    const bySlot = items.reduce<Record<string, number>>((acc, item) => {
      const key = item.slotId
      acc[key] = (acc[key] || 0) + 1
      return acc
    }, {})

    const byPriority = items.reduce<Record<string, number>>((acc, item) => {
      const priority = derivePriority(item)
      acc[priority] = (acc[priority] || 0) + 1
      return acc
    }, {})

    return {
      total,
      expired,
      expiringSoon,
      fresh,
      bySlot,
      byPriority,
    }
  }, [items])
}

export function useItemsBySlot() {
  const { items, slots } = useFridge()

  return useMemo(() => {
    const grouped = items.reduce<Record<string, Item[]>>((acc, item) => {
      const key = item.slotId || `slot-${item.slotIndex}`
      if (!acc[key]) {
        acc[key] = []
      }
      acc[key].push(item)
      return acc
    }, {})

    return slots.map((slot) => ({
      slot,
      items: grouped[slot.slotId] || [],
    }))
  }, [items, slots])
}

export function useBundles() {
  const { items } = useFridge()

  return useMemo(() => {
    const bundleMap = new Map<string, Item[]>()

    items.forEach((item) => {
      if (item.bundleId) {
        if (!bundleMap.has(item.bundleId)) {
          bundleMap.set(item.bundleId, [])
        }
        bundleMap.get(item.bundleId)!.push(item)
      }
    })

    return Array.from(bundleMap.entries()).map(([bundleId, groupedItems]) => ({
      bundleId,
      items: groupedItems,
      bundleCode: groupedItems[0]?.bundleLabelDisplay || "",
      slotLabel: groupedItems[0]?.slotLetter || "",
      name: groupedItems[0]?.bundleName || "",
      count: groupedItems.length,
    }))
  }, [items])
}

const derivePriority = (item: Item): ItemPriority => {
  const diff = daysLeft(item.expiryDate)
  if (diff <= 1) return "high"
  if (diff <= 3) return "medium"
  return "low"
}

export function useSearchOptimized(initialValue = '') {
  const [searchTerm, setSearchTerm] = useState(initialValue)
  const debounceRef = useRef<NodeJS.Timeout>()
  
  const setSearchTermDebounced = useCallback((value: string) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }
    
    debounceRef.current = setTimeout(() => {
      setSearchTerm(value)
    }, 300)
  }, [])
  
  return [searchTerm, setSearchTermDebounced] as const
}

export function useInfiniteScroll<T>(
  items: T[],
  pageSize: number = 20
) {
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  
  const paginatedItems = useMemo(() => {
    return items.slice(0, page * pageSize)
  }, [items, page, pageSize])
  
  const loadMore = useCallback(() => {
    if (page * pageSize < items.length) {
      setPage(prev => prev + 1)
    } else {
      setHasMore(false)
    }
  }, [page, pageSize, items.length])
  
  const reset = useCallback(() => {
    setPage(1)
    setHasMore(true)
  }, [])
  
  return {
    items: paginatedItems,
    hasMore,
    loadMore,
    reset,
    page
  }
}

export function useVirtualizedItems<T>(
  items: T[],
  itemHeight: number,
  containerHeight: number
) {
  const [scrollTop, setScrollTop] = useState(0)
  
  const visibleRange = useMemo(() => {
    const startIndex = Math.floor(scrollTop / itemHeight)
    const endIndex = Math.min(
      startIndex + Math.ceil(containerHeight / itemHeight) + 1,
      items.length
    )
    
    return {
      start: Math.max(0, startIndex - 5), // 버퍼
      end: endIndex + 5
    }
  }, [scrollTop, itemHeight, containerHeight, items.length])
  
  const visibleItems = useMemo(() => {
    return items.slice(visibleRange.start, visibleRange.end)
  }, [items, visibleRange])
  
  const totalHeight = items.length * itemHeight
  const offsetY = visibleRange.start * itemHeight
  
  return {
    visibleItems,
    totalHeight,
    offsetY,
    setScrollTop
  }
}

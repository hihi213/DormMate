import { useMemo, useCallback, useRef, useState } from 'react'
import { useFridgeStore } from '@/stores/fridge-store'
import type { Item, Slot, FilterOptions } from '@/components/fridge/types'
import { getItemStatus, getItemPriority } from '@/lib/fridge-logic'

// 필터링된 아이템 계산 (메모이제이션)
export function useFilteredItems(filters: FilterOptions) {
  const items = useFridgeStore(state => state.items)
  
  return useMemo(() => {
    return items.filter(item => {
      // 슬롯 필터
      if (filters.slotCode && item.slotCode !== filters.slotCode) {
        return false
      }
      
      // 상태 필터
      if (filters.status && getItemStatus(item.expiry) !== filters.status) {
        return false
      }
      
      // 우선순위 필터
      if (filters.priority && getItemPriority(item.expiry) !== filters.priority) {
        return false
      }
      
      // 검색어 필터
      if (filters.search && !item.name.toLowerCase().includes(filters.search.toLowerCase())) {
        return false
      }
      
      // 소유자 필터
      if (filters.owner && item.owner !== filters.owner) {
        return false
      }
      
      return true
    })
  }, [items, filters])
}

// 통계 계산 (메모이제이션)
export function useFridgeStats() {
  const items = useFridgeStore(state => state.items)
  
  return useMemo(() => {
    const total = items.length
    const expired = items.filter(item => getItemStatus(item.expiry) === 'expired').length
    const expiringSoon = items.filter(item => getItemStatus(item.expiry) === 'expiring-soon').length
    const fresh = items.filter(item => getItemStatus(item.expiry) === 'fresh').length
    
    const bySlot = items.reduce((acc, item) => {
      acc[item.slotCode] = (acc[item.slotCode] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    
    const byPriority = items.reduce((acc, item) => {
      const priority = getItemPriority(item.expiry)
      acc[priority] = (acc[priority] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    
    return {
      total,
      expired,
      expiringSoon,
      fresh,
      bySlot,
      byPriority
    }
  }, [items])
}

// 슬롯별 아이템 그룹화 (메모이제이션)
export function useItemsBySlot() {
  const items = useFridgeStore(state => state.items)
  const slots = useFridgeStore(state => state.slots)
  
  return useMemo(() => {
    const grouped = items.reduce((acc, item) => {
      if (!acc[item.slotCode]) {
        acc[item.slotCode] = []
      }
      acc[item.slotCode].push(item)
      return acc
    }, {} as Record<string, Item[]>)
    
    // 슬롯 순서대로 정렬
    return slots.map(slot => ({
      slot,
      items: grouped[slot.code] || []
    }))
  }, [items, slots])
}

// 묶음 그룹화 (메모이제이션)
export function useBundles() {
  const items = useFridgeStore(state => state.items)
  
  return useMemo(() => {
    const bundleMap = new Map<string, Item[]>()
    
    items.forEach(item => {
      if (item.bundleId) {
        if (!bundleMap.has(item.bundleId)) {
          bundleMap.set(item.bundleId, [])
        }
        bundleMap.get(item.bundleId)!.push(item)
      }
    })
    
    return Array.from(bundleMap.entries()).map(([bundleId, items]) => ({
      bundleId,
      items,
      bundleCode: items[0]?.groupCode || '',
      slotCode: items[0]?.slotCode || '',
      name: items[0]?.name || '',
      count: items.length
    }))
  }, [items])
}

// 검색 최적화 (디바운싱)
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

// 무한 스크롤 훅
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

// 가상화를 위한 아이템 인덱스 계산
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

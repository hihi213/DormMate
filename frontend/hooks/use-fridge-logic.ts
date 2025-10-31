import { useMemo, useCallback } from "react"
import type { Item, Slot, FilterOptions, FridgeStats, ItemStatus } from "@/features/fridge/types"
import { daysLeft } from "@/lib/date-utils"

const isMineFor = (item: Item, currentUserId?: string) => {
  if (currentUserId) return item.ownerId === currentUserId
  return item.owner === "me"
}

export function useFridgeLogic(items: Item[], slots: Slot[], currentUserId?: string) {
  const getItemStatus = useCallback((expiryDate: string, freshness?: string | null): ItemStatus => {
    if (freshness === "expired" || freshness === "expiring" || freshness === "ok") {
      return freshness
    }
    const days = daysLeft(expiryDate)
    if (days < 0) return "expired"
    if (days <= 3) return "expiring"
    return "ok"
  }, [])

  const itemsWithStatus = useMemo(() => {
    return items.map((item) => ({
      ...item,
      status: getItemStatus(item.expiryDate, item.freshness),
    }))
  }, [items, getItemStatus])

  const getFilteredItems = useCallback(
    (options: FilterOptions) => {
      const query = options.searchQuery?.trim().toLowerCase() ?? ""

      const matchesBaseFilters = (item: typeof itemsWithStatus[number]) => {
        const mine = isMineFor(item, currentUserId)
        switch (options.tab) {
          case "mine":
            if (!mine) return false
            break
          case "expiring":
            if (item.status !== "expiring") return false
            break
          case "expired":
            if (item.status !== "expired") return false
            break
        }

        if (options.slotId && item.slotId !== options.slotId) return false
        if (typeof options.slotIndex === "number" && item.slotIndex !== options.slotIndex) return false

        if (options.myOnly && !mine) return false
        return true
      }

      const preliminary: typeof itemsWithStatus = []
      const matchedBundles = new Set<string>()

      for (const item of itemsWithStatus) {
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
        let aValue: string | number
        let bValue: string | number

        switch (options.sortBy) {
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

        if (options.sortOrder === "desc") {
          ;[aValue, bValue] = [bValue, aValue]
        }

        if (typeof aValue === "string") {
          return aValue.localeCompare(bValue as string)
        }
        return (aValue as number) - (bValue as number)
      })

      return filtered
    },
    [itemsWithStatus, slots, currentUserId],
  )

  const getStats = useCallback((): FridgeStats => {
    const stats: FridgeStats = {
      totalItems: items.length,
      myItems: items.filter((item) => isMineFor(item, currentUserId)).length,
      expiringItems: itemsWithStatus.filter((item) => item.status === "expiring").length,
      expiredItems: itemsWithStatus.filter((item) => item.status === "expired").length,
      bySlot: {},
      byStatus: { ok: 0, expiring: 0, expired: 0 },
    }

    items.forEach((item) => {
      const key = item.slotId
      stats.bySlot[key] = (stats.bySlot[key] || 0) + 1
    })

    itemsWithStatus.forEach((item) => {
      if (item.status) stats.byStatus[item.status]++
    })

    return stats
  }, [items, itemsWithStatus, currentUserId])

  const getBundles = useCallback(() => {
    const bundles = new Map<string, Item[]>()
    itemsWithStatus.forEach((item) => {
      if (!bundles.has(item.bundleId)) {
        bundles.set(item.bundleId, [])
      }
      bundles.get(item.bundleId)!.push(item)
    })

    return Array.from(bundles.entries()).map(([bundleId, list]) => {
      const [first] = list
      return {
        bundleId,
        items: list.sort((a, b) => a.seqNo - b.seqNo),
        name: first?.bundleName ?? "포장",
        slotId: first?.slotId ?? "",
        slotIndex: first?.slotIndex ?? 0,
        earliestExpiry: list.reduce(
          (earliest, unit) =>
            new Date(unit.expiryDate) < new Date(earliest) ? unit.expiryDate : earliest,
          first?.expiryDate ?? new Date().toISOString().slice(0, 10),
        ),
      }
    })
  }, [itemsWithStatus])

  const getBundleName = useCallback((name: string) => name, [])

  const getDetailName = useCallback((name: string, bundleName: string) => {
    const prefix = `${bundleName} - `
    return name.startsWith(prefix) ? name.slice(prefix.length) : name
  }, [])

  const getExpiringItems = useCallback(
    (daysThreshold = 3) => {
      return itemsWithStatus.filter((item) => {
        const days = daysLeft(item.expiryDate)
        return days >= 0 && days <= daysThreshold
      })
    },
    [itemsWithStatus],
  )

  const getExpiredItems = useCallback(() => {
    return itemsWithStatus.filter((item) => item.status === "expired")
  }, [itemsWithStatus])

  return {
    itemsWithStatus,
    getFilteredItems,
    getStats,
    getBundles,
    getBundleName,
    getDetailName,
    getExpiringItems,
    getExpiredItems,
    getItemStatus,
  }
}

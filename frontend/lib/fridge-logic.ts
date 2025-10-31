import type { Item } from "@/features/fridge/types"
import { formatBundleLabel } from "@/features/fridge/utils/data-shaping"
import { daysLeft } from "./date-utils"

type FreshnessValue = "expired" | "expiring" | "ok"

const isFreshnessValue = (value: unknown): value is FreshnessValue =>
  value === "expired" || value === "expiring" || value === "ok"

export function getBundleName(name: string) {
  const idx = name.indexOf(" - ")
  return idx >= 0 ? name.slice(0, idx) : name
}

export function getDetailName(name: string, bundleName: string) {
  const prefix = `${bundleName} - `
  return name.startsWith(prefix) ? name.slice(prefix.length) : name
}

export function earliestDays(group: Item[]) {
  let min = Number.POSITIVE_INFINITY
  for (const it of group) {
    const dl = daysLeft(it.expiryDate)
    if (dl < min) min = dl
  }
  return min
}

export function resolveStatus(expiryISO: string, freshness?: string | null): FreshnessValue {
  if (isFreshnessValue(freshness)) {
    return freshness
  }
  const d = daysLeft(expiryISO)
  if (d < 0) return "expired"
  if (d <= 3) return "expiring"
  return "ok"
}

export function formatBundleCode(slotIndex: number, labelNumber: number) {
  return formatBundleLabel(slotIndex, labelNumber)
}

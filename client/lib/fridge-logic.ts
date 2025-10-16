import type { Item } from "@/features/fridge/types"
import { daysLeft } from "./date-utils"

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
    const dl = daysLeft(it.expiry)
    if (dl < min) min = dl
  }
  return min
}

export function resolveStatus(expiryISO: string): "expired" | "expiring" | "ok" {
  const d = daysLeft(expiryISO)
  if (d < 0) return "expired"
  if (d <= 1) return "expiring"
  return "ok"
}

export function formatBundleCode(slotCode: string, labelNo: number) {
  return `${slotCode}-${String(labelNo).padStart(3, "0")}`
}

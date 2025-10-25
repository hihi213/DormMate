import {
  FRIDGE_BUNDLES_KEY,
  FRIDGE_SLOTS_KEY,
  FRIDGE_UNITS_KEY,
  generateDefaultFridgeData,
} from "@/features/fridge/utils/data-shaping"
import { addDays } from "@/lib/date-utils"

const SCHEDULE_KEY = "fridge-inspections-schedule-v1"
const HISTORY_KEY = "fridge-inspections-history-v1"

const CLEAR_ONLY_KEYS = [
  "laundry-messages",
  "my-laundry-end",
  "my-laundry-total-sec",
  "my-laundry-device",
  "library-my-loans",
]

const toIsoAtHour = (base: Date, hour: number) => {
  const d = new Date(base)
  d.setHours(hour, 0, 0, 0)
  return d.toISOString()
}

function generateInspectionScheduleSeed() {
  const now = new Date()
  return [
    {
      id: "seed-past-1",
      dateISO: toIsoAtHour(addDays(now, -5), 9),
      title: "주간 점검",
      notes: "2층 냉장고",
      completed: true,
      completedAt: toIsoAtHour(addDays(now, -5), 11),
      completedBy: "bob",
      summary: { passed: 3, warned: 1, discarded: 0 },
    },
    {
      id: "seed-upcoming-1",
      dateISO: toIsoAtHour(addDays(now, 2), 9),
      title: "정기 점검",
      notes: "2층 전체",
      completed: false,
    },
    {
      id: "seed-upcoming-2",
      dateISO: toIsoAtHour(addDays(now, 8), 10),
      title: "월간 위생 점검",
      notes: "상층 포함",
      completed: false,
    },
  ]
}

function generateInspectionHistorySeed() {
  const now = new Date()
  return [
    {
      id: "seed-history-1",
      dateISO: toIsoAtHour(addDays(now, -6), 12),
      passed: 2,
      warned: 1,
      discarded: 0,
      notes: "처리 3건",
    },
  ]
}

export function resetAndSeedAll(forceUserId?: string) {
  if (typeof window === "undefined") return

  const fridgeData = generateDefaultFridgeData()

  localStorage.setItem(FRIDGE_SLOTS_KEY, JSON.stringify(fridgeData.slots))
  localStorage.setItem(FRIDGE_BUNDLES_KEY, JSON.stringify(fridgeData.bundles))
  localStorage.setItem(FRIDGE_UNITS_KEY, JSON.stringify(fridgeData.units))

  localStorage.setItem(SCHEDULE_KEY, JSON.stringify(generateInspectionScheduleSeed()))
  localStorage.setItem(HISTORY_KEY, JSON.stringify(generateInspectionHistorySeed()))

  CLEAR_ONLY_KEYS.forEach((key) => localStorage.removeItem(key))

  if (forceUserId) {
    localStorage.setItem("auth-user", forceUserId)
  }
}

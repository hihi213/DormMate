import { safeApiCall } from "@/lib/api-client"

const SCHEDULE_KEY = "fridge-inspections-schedule-v1"
const HISTORY_KEY = "fridge-inspections-history-v1"

const CLEAR_ONLY_KEYS = [
  "laundry-messages",
  "my-laundry-end",
  "my-laundry-total-sec",
  "my-laundry-device",
  "library-my-loans",
]

const LEGACY_FRIDGE_CACHE_KEYS = ["fridge-slots", "fridge-bundles", "fridge-units"]

function clearDemoCaches() {
  if (typeof window === "undefined") {
    return
  }

  const keysToClear = [SCHEDULE_KEY, HISTORY_KEY, ...LEGACY_FRIDGE_CACHE_KEYS, ...CLEAR_ONLY_KEYS]
  keysToClear.forEach((key) => window.localStorage.removeItem(key))
}

export async function resetDemoDataset() {
  if (typeof window === "undefined") {
    return
  }

  const { error } = await safeApiCall<{ message?: string }>("/admin/seed/fridge-demo", {
    method: "POST",
  })

  if (error) {
    throw new Error(error.message ?? "데모 데이터를 초기화하지 못했습니다. 관리자 권한을 확인해 주세요.")
  }

  clearDemoCaches()
}

export async function resetAndSeedAll() {
  await resetDemoDataset()
}

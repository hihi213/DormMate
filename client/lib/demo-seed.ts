const KEYS = [
  "fridge-inspections-schedule-v1",
  "laundry-messages",
  "my-laundry-end",
  "my-laundry-total-sec",
  "my-laundry-device",
  "library-my-loans",
]

export function resetAndSeedAll(forceUserId?: string) {
  if (typeof window === "undefined") return
  KEYS.forEach((key) => localStorage.removeItem(key))
}

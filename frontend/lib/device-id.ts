const DEVICE_ID_KEY = "dm.device.id"

let cachedDeviceId: string | null = null

function generateDeviceId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `web-${crypto.randomUUID()}`
  }
  return `web-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`
}

export function getDeviceId(): string {
  if (cachedDeviceId) {
    return cachedDeviceId
  }

  if (typeof window === "undefined") {
    cachedDeviceId = "server"
    return cachedDeviceId
  }

  try {
    const stored = window.localStorage.getItem(DEVICE_ID_KEY)
    if (stored && stored.length > 0) {
      cachedDeviceId = stored
      return stored
    }
  } catch {
    // localStorage access can fail (private mode), fall back to in-memory id
  }

  const deviceId = generateDeviceId()
  cachedDeviceId = deviceId

  try {
    window.localStorage.setItem(DEVICE_ID_KEY, deviceId)
  } catch {
    // ignore write errors (e.g., storage quota)
  }

  return deviceId
}

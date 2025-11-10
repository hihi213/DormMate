import type { RoomDetails } from "@/lib/auth"
import type { Slot } from "@/features/fridge/types"

const ROOMS_PER_FLOOR = 24

export function computePermittedSlotIds(
  slots: Slot[],
  roomDetails?: RoomDetails | null,
): Set<string> {
  const permitted = new Set<string>()
  if (!roomDetails?.floor) return permitted

  const floorSlots = slots.filter((slot) => slot.floorNo === roomDetails.floor)
  if (floorSlots.length === 0) {
    return permitted
  }

  const targetOrdinal = resolveRoomOrdinal(roomDetails)

  const chillSlots = floorSlots
    .filter((slot) => slot.compartmentType === "CHILL")
    .sort((a, b) => a.slotIndex - b.slotIndex)

  if (targetOrdinal && chillSlots.length > 0) {
    const baseChunk = Math.max(1, Math.floor(ROOMS_PER_FLOOR / chillSlots.length))
    const remainder = ROOMS_PER_FLOOR % chillSlots.length
    let start = 1
    chillSlots.forEach((slot, index) => {
      const bucketSize = baseChunk + (index < remainder ? 1 : 0)
      const end = start + bucketSize - 1
      if (targetOrdinal >= start && targetOrdinal <= end) {
        permitted.add(slot.slotId)
      }
      start = end + 1
    })
  }

  const freezeSlots = floorSlots.filter((slot) => slot.compartmentType === "FREEZE")
  freezeSlots.forEach((slot) => permitted.add(slot.slotId))

  if (permitted.size === 0) {
    chillSlots.forEach((slot) => permitted.add(slot.slotId))
    freezeSlots.forEach((slot) => permitted.add(slot.slotId))
  }

  return permitted
}

export function resolveRoomOrdinal(roomDetails?: RoomDetails | null): number | null {
  if (!roomDetails) return null
  if (typeof roomDetails.personalNo === "number" && Number.isFinite(roomDetails.personalNo)) {
    return roomDetails.personalNo
  }
  return normalizeRoomOrdinal(roomDetails.roomNumber)
}

export function normalizeRoomOrdinal(roomNumber?: string | number | null): number | null {
  if (!roomNumber) return null
  const digits = String(roomNumber).replace(/\D+/g, "")
  if (!digits) return null
  const numeric = Number.parseInt(digits, 10)
  if (!Number.isFinite(numeric)) return null
  const ordinal = numeric % 100
  if (ordinal <= 0) return null
  return ordinal
}

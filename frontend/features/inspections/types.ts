import type { Bundle, Item, ItemUnit, Slot } from "@/features/fridge/types"

export type InspectionStatus = "IN_PROGRESS" | "SUBMITTED" | "CANCELED" | "CANCELLED"

export type NormalizedInspectionStatus = "IN_PROGRESS" | "SUBMITTED" | "CANCELED"

export function normalizeInspectionStatus(status: InspectionStatus): NormalizedInspectionStatus {
  return status === "CANCELLED" ? "CANCELED" : status
}

export type InspectionAction =
  | "WARN_INFO_MISMATCH"
  | "WARN_STORAGE_POOR"
  | "DISPOSE_EXPIRED"
  | "PASS"
  | "UNREGISTERED_DISPOSE"

export type InspectionActionSummary = {
  action: InspectionAction
  count: number
}

export type InspectionActionItemDetail = {
  id: number
  fridgeItemId?: string | null
  snapshotName?: string | null
  snapshotExpiresOn?: string | null
  quantityAtAction?: number | null
  correlationId?: string | null
}

export type InspectionPenalty = {
  id: string
  points: number
  reason?: string | null
  issuedAt: string
  expiresAt?: string | null
  correlationId?: string | null
}

export type InspectionActionDetail = {
  actionId: number
  actionType: InspectionAction
  bundleId?: string | null
  targetUserId?: string | null
  recordedAt: string
  recordedBy?: string | null
  note?: string | null
  correlationId?: string | null
  items: InspectionActionItemDetail[]
  penalties: InspectionPenalty[]
}

export type InspectionSession = {
  sessionId: string
  slotId: string
  slotIndex: number
  slotLetter: string
  floorNo: number
  floorCode?: string | null
  status: InspectionStatus
  startedBy: string
  startedAt: string
  endedAt?: string | null
  bundles: Bundle[]
  units: ItemUnit[]
  items: Item[]
  summary: InspectionActionSummary[]
  actions: InspectionActionDetail[]
  notes?: string | null
  initialBundleCount?: number | null
  totalBundleCount?: number | null
}

export type InspectionActionEntry = {
  bundleId?: string | null
  itemId?: string | null
  action: InspectionAction
  note?: string | null
}

export type InspectionSubmitPayload = {
  notes?: string
}

export type AvailableSlot = Slot

export type InspectionScheduleStatus = "SCHEDULED" | "COMPLETED" | "CANCELLED"

export type InspectionSchedule = {
  scheduleId: string
  scheduledAt: string
  title?: string | null
  notes?: string | null
  status: InspectionScheduleStatus
  completedAt?: string | null
  inspectionSessionId?: string | null
  fridgeCompartmentId?: string | null
  slotIndex?: number | null
  slotLetter?: string | null
  floorNo?: number | null
  floorCode?: string | null
  createdAt: string
  updatedAt: string
}

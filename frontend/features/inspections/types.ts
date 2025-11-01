import type { Bundle, Item, ItemUnit, Slot } from "@/features/fridge/types"

export type InspectionStatus = "IN_PROGRESS" | "SUBMITTED" | "CANCELED"

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
  notes?: string | null
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
  createdAt: string
  updatedAt: string
}

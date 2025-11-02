import { formatBundleLabel, toSlotLetter } from "@/features/fridge/utils/data-shaping"
import type {
  CompartmentType,
  FloorCode,
  ResourceStatus,
  Slot,
} from "@/features/fridge/types"
import type {
  AdminBundleSummaryDto,
  AdminFridgeSlotDto,
  AdminInspectionSessionDto,
} from "@/features/admin/api/fridge"

export type AdminFridgeSlot = Slot & {
  utilization?: number | null
}

export type AdminBundleSummary = {
  bundleId: string
  slotId: string
  slotIndex: number
  labelDisplay: string
  bundleName: string
  itemCount: number
  status: "ACTIVE" | "DELETED"
  freshness?: string | null
  ownerDisplayName?: string | null
  ownerRoomNumber?: string | null
  memo?: string | null
  updatedAt: string
  removedAt?: string | null
  deletedAt?: string | null
}

export type AdminInspectionAggregate = {
  action: string
  count: number
}

export type AdminInspectionSession = {
  sessionId: string
  slotId: string
  slotLabel: string
  floorNo: number
  status: "IN_PROGRESS" | "SUBMITTED" | "CANCELED"
  startedAt: string
  endedAt?: string | null
  startedBy: string
  summary: AdminInspectionAggregate[]
  warningCount: number
  disposalCount: number
  passCount: number
}

const WARN_ACTIONS = new Set(["WARN_INFO_MISMATCH", "WARN_STORAGE_POOR"])
const DISPOSAL_ACTIONS = new Set(["DISPOSE_EXPIRED", "UNREGISTERED_DISPOSE"])

export function mapAdminSlot(dto: AdminFridgeSlotDto): AdminFridgeSlot {
  const slotLetter =
    dto.slotLetter && dto.slotLetter.length > 0 ? dto.slotLetter : toSlotLetter(dto.slotIndex)
  const capacity = dto.capacity ?? null
  const occupiedCount = dto.occupiedCount ?? null

  let utilization: number | null = null
  if (typeof capacity === "number" && capacity > 0 && typeof occupiedCount === "number") {
    utilization = Math.min(1, Math.max(0, occupiedCount / capacity))
  }

  return {
    slotId: dto.slotId,
    slotIndex: dto.slotIndex,
    slotLetter,
    floorNo: dto.floorNo,
    floorCode: dto.floorCode as FloorCode,
    compartmentType: dto.compartmentType as CompartmentType,
    resourceStatus: dto.resourceStatus as ResourceStatus,
    locked: dto.locked,
    lockedUntil: dto.lockedUntil ?? null,
    capacity,
    displayName: dto.displayName ?? null,
    occupiedCount,
    utilization,
  }
}

export function mapAdminBundleSummary(dto: AdminBundleSummaryDto): AdminBundleSummary {
  const slotIndex = dto.slotIndex ?? 0
  const labelNumber = dto.labelNumber ?? 0
  const labelDisplay = dto.labelDisplay ?? formatBundleLabel(slotIndex, labelNumber)
  const removedAt = dto.removedAt ?? null
  const deletedAt = (dto as { deletedAt?: string | null }).deletedAt ?? null
  const status = (dto.status?.toUpperCase() as "ACTIVE" | "DELETED") ?? "ACTIVE"

  return {
    bundleId: dto.bundleId,
    slotId: dto.slotId,
    slotIndex,
    labelDisplay,
    bundleName: dto.bundleName,
    itemCount: dto.itemCount ?? 0,
    status,
    freshness: dto.freshness ?? null,
    ownerDisplayName: dto.ownerDisplayName ?? null,
    ownerRoomNumber: dto.ownerRoomNumber ?? null,
    memo: dto.memo ?? null,
    updatedAt: dto.updatedAt,
    removedAt,
    deletedAt,
  }
}

export function mapAdminInspectionSession(
  session: AdminInspectionSessionDto,
): AdminInspectionSession {
  const summary = session.summary ?? []
  let warningCount = 0
  let disposalCount = 0
  let passCount = 0

  summary.forEach((entry) => {
    if (!entry) return
    const action = entry.action ?? ""
    const count = entry.count ?? 0
    if (WARN_ACTIONS.has(action)) {
      warningCount += count
    } else if (DISPOSAL_ACTIONS.has(action)) {
      disposalCount += count
    } else if (action === "PASS") {
      passCount += count
    }
  })

  const slotLabel =
    session.slotLabel && session.slotLabel.length > 0
      ? session.slotLabel
      : toSlotLetter(session.slotIndex ?? 0)

  return {
    sessionId: session.sessionId,
    slotId: session.slotId,
    slotLabel,
    floorNo: session.floorNo ?? 0,
    status: (session.status ?? "IN_PROGRESS") as AdminInspectionSession["status"],
    startedAt: session.startedAt,
    endedAt: session.endedAt ?? null,
    startedBy: session.startedBy,
    summary: summary.map((entry) => ({
      action: entry.action,
      count: entry.count,
    })),
    warningCount,
    disposalCount,
    passCount,
  }
}

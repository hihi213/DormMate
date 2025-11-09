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
} from "@/features/admin/api"

export type AdminFridgeSlot = Slot & {
  utilization?: number | null
}

export type AdminBundleSummary = {
  bundleId: string
  canonicalId?: string | null
  slotId: string
  slotIndex: number
  labelDisplay: string
  bundleName: string
  itemCount: number
  status: "ACTIVE" | "DELETED"
  freshness?: string | null
  ownerUserId?: string | null
  ownerDisplayName?: string | null
  ownerRoomNumber?: string | null
  memo?: string | null
  updatedAt: string
  removedAt?: string | null
  deletedAt?: string | null
  version?: number | null
  lastInspectionId?: string | null
  lastInspectionAt?: string | null
  warningCount?: number | null
  disposalCount?: number | null
  alertState?: string | null
}

export type AdminInspectionAggregate = {
  action: string
  count: number
}

export type AdminInspectionActionItem = {
  id?: number | null
  fridgeItemId?: string | null
  snapshotName?: string | null
  snapshotExpiresOn?: string | null
  quantityAtAction?: number | null
}

export type AdminPenaltyHistory = {
  id?: string
  points?: number
  reason?: string | null
  issuedAt?: string
  expiresAt?: string | null
}

export type AdminInspectionActionDetail = {
  actionId?: number | null
  actionType?: string | null
  bundleId?: string | null
  targetUserId?: string | null
  recordedAt?: string
  recordedBy?: string | null
  recordedByLogin?: string | null
  recordedByName?: string | null
  note?: string | null
  correlationId?: string | null
  roomNumber?: string | null
  personalNo?: number | null
  targetName?: string | null
  notificationStatus?: string | null
  penaltyPoints?: number | null
  items: AdminInspectionActionItem[]
  penalties: AdminPenaltyHistory[]
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
  startedByLogin?: string | null
  startedByName?: string | null
  startedByRoomNumber?: string | null
  startedByPersonalNo?: number | null
  summary: AdminInspectionAggregate[]
  warningCount: number
  disposalCount: number
  passCount: number
  notes?: string | null
  hasIssue: boolean
  actions: AdminInspectionActionDetail[]
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

type BundleSummaryExtras = AdminBundleSummaryDto & {
  ownerUserId?: string | null
  ownerDisplayName?: string | null
  ownerRoomNumber?: string | null
  memo?: string | null
  freshness?: string | null
  canonicalId?: string | null
  lastInspectionId?: string | null
  lastInspectionAt?: string | null
  warningCount?: number | null
  disposalCount?: number | null
  alertState?: string | null
  removedAt?: string | null
  deletedAt?: string | null
}

export function mapAdminBundleSummary(dto: AdminBundleSummaryDto): AdminBundleSummary {
  const extended = dto as BundleSummaryExtras
  const slotIndex = extended.slotIndex ?? 0
  const labelNumber = extended.labelNumber ?? 0
  const labelDisplay = extended.labelDisplay ?? formatBundleLabel(slotIndex, labelNumber)
  const removedAt = extended.removedAt ?? null
  const deletedAt = extended.deletedAt ?? null
  const status = (extended.status?.toUpperCase() as "ACTIVE" | "DELETED") ?? "ACTIVE"

  return {
    bundleId: extended.bundleId,
    canonicalId: extended.canonicalId ?? extended.bundleId ?? null,
    slotId: extended.slotId,
    slotIndex,
    labelDisplay,
    bundleName: extended.bundleName,
    itemCount: extended.itemCount ?? 0,
    status,
    freshness: extended.freshness ?? null,
    ownerUserId: extended.ownerUserId ?? null,
    ownerDisplayName: extended.ownerDisplayName ?? null,
    ownerRoomNumber: extended.ownerRoomNumber ?? null,
    memo: extended.memo ?? null,
    updatedAt: extended.updatedAt,
    removedAt,
    deletedAt,
    version: extended.version ?? null,
    lastInspectionId: extended.lastInspectionId ?? null,
    lastInspectionAt: extended.lastInspectionAt ?? null,
    warningCount: extended.warningCount ?? null,
    disposalCount: extended.disposalCount ?? null,
    alertState: extended.alertState ?? null,
  }
}

type InspectionActionDtoExtras =
  NonNullable<NonNullable<AdminInspectionSessionDto["actions"]>[number]> & {
    roomNumber?: string | null
    personalNo?: number | null
    targetName?: string | null
    notificationStatus?: string | null
    penaltyPoints?: number | null
    recordedAt?: string | null
    recordedBy?: string | null
    recordedByLogin?: string | null
    recordedByName?: string | null
  }

type InspectionSessionDtoExtras = AdminInspectionSessionDto & {
    startedByLogin?: string | null
    startedByName?: string | null
    startedByRoomNumber?: string | null
    startedByPersonalNo?: number | null
    slotIndex?: number | null
    actions?: Array<InspectionActionDtoExtras | null>
}

export function mapAdminInspectionSession(
  session: AdminInspectionSessionDto,
): AdminInspectionSession {
  const extended = session as InspectionSessionDtoExtras
  const summary = extended.summary ?? []
  const actions = extended.actions ?? []
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
    extended.slotLabel && extended.slotLabel.length > 0
      ? extended.slotLabel
      : toSlotLetter(extended.slotIndex ?? 0)

  const rawStatus = (extended.status ?? "IN_PROGRESS") as string
  const normalizedStatus = (rawStatus === "CANCELLED" ? "CANCELED" : rawStatus) as AdminInspectionSession["status"]

  return {
    sessionId: extended.sessionId,
    slotId: extended.slotId,
    slotLabel,
    floorNo: extended.floorNo ?? 0,
    status: normalizedStatus,
    startedAt: extended.startedAt,
    endedAt: extended.endedAt ?? null,
    startedBy: extended.startedBy,
    startedByLogin: extended.startedByLogin ?? null,
    startedByName: extended.startedByName ?? null,
    startedByRoomNumber: extended.startedByRoomNumber ?? null,
    startedByPersonalNo: extended.startedByPersonalNo ?? null,
    summary: summary.map((entry) => ({
      action: entry.action,
      count: entry.count,
    })),
    warningCount,
    disposalCount,
    passCount,
    notes: session.notes ?? null,
    hasIssue: warningCount > 0 || disposalCount > 0,
    actions: actions
      .filter((action): action is InspectionActionDtoExtras => Boolean(action))
      .map((action) => {
        const items = (action.items ?? [])
          .filter((item): item is NonNullable<typeof item> => Boolean(item))
          .map((item) => ({
            id: item.id ?? null,
            fridgeItemId: item.fridgeItemId ?? null,
            snapshotName: item.snapshotName ?? null,
            snapshotExpiresOn: item.snapshotExpiresOn ?? null,
            quantityAtAction: item.quantityAtAction ?? null,
          }))

        const penalties = (action.penalties ?? [])
          .filter((penalty): penalty is NonNullable<typeof penalty> => Boolean(penalty))
          .map((penalty) => ({
            id: penalty.id ?? "",
            points: penalty.points ?? 0,
            reason: penalty.reason ?? null,
            issuedAt: penalty.issuedAt ?? undefined,
            expiresAt: penalty.expiresAt ?? undefined,
          }))

        return {
          actionId: action.actionId ?? null,
          actionType: action.actionType ?? null,
          bundleId: action.bundleId ?? null,
          targetUserId: action.targetUserId ?? null,
          recordedAt: action.recordedAt ?? undefined,
          recordedBy: action.recordedBy ?? null,
          recordedByLogin: action.recordedByLogin ?? null,
          recordedByName: action.recordedByName ?? null,
          note: action.note ?? null,
          correlationId: action.correlationId ?? null,
          roomNumber: action.roomNumber ?? null,
          personalNo: action.personalNo ?? null,
          targetName: action.targetName ?? null,
          notificationStatus: action.notificationStatus ?? null,
          penaltyPoints: action.penaltyPoints ?? null,
          items,
          penalties,
        }
      }),
  }
}

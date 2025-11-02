export type FloorCode = "2F" | "3F" | "4F" | "5F"

export type CompartmentType = "CHILL" | "FREEZE"

export type ResourceStatus = "ACTIVE" | "SUSPENDED" | "REPORTED" | "RETIRED"

export type UpdateCompartmentConfigPayload = {
  maxBundleCount?: number
  status?: ResourceStatus
}

export type Slot = {
  slotId: string
  slotIndex: number
  slotLetter: string
  floorNo: number
  floorCode: FloorCode
  compartmentType: CompartmentType
  resourceStatus: ResourceStatus
  locked: boolean
  lockedUntil?: string | null
  capacity?: number | null
  displayName?: string | null
  occupiedCount?: number | null
}

export type Owner = "me" | "other"

export type ItemStatus = "ok" | "expiring" | "expired"

export type ItemPriority = "low" | "medium" | "high"

export type BundleStatus = "ACTIVE" | "DELETED"

export type Bundle = {
  bundleId: string
  slotId: string
  slotIndex: number
  slotLetter: string
  labelNumber: number
  labelDisplay: string
  bundleName: string
  memo?: string | null
  ownerUserId?: string | null
  ownerDisplayName?: string | null
  ownerRoomNumber?: string | null
  owner?: Owner
  ownerId?: string
  status: BundleStatus
  freshness?: string | null
  itemCount: number
  createdAt: string
  updatedAt: string
  removedAt?: string | null
}

export type ItemUnit = {
  unitId: string
  bundleId: string
  seqNo: number
  name: string
  expiryDate: string
  quantity?: number | null
  unitCode?: string | null
  freshness?: string | null
  lastInspectedAt?: string | null
  updatedAfterInspection: boolean
  memo?: string | null
  priority?: ItemPriority
  createdAt: string
  updatedAt: string
  removedAt?: string | null
}

// UI 보조용 파생 아이템 타입 (bundle + unit 조합)
export type Item = {
  id: string
  bundleId: string
  unitId: string
  slotId: string
  slotIndex: number
  slotLetter: string
  labelNumber: number
  seqNo: number
  displayLabel: string
  bundleLabelDisplay: string
  bundleName: string
  name: string
  expiryDate: string
  unitCode?: string | null
  lastInspectedAt?: string | null
  updatedAfterInspection: boolean
  memo?: string | null
  quantity?: number | null
  owner?: Owner
  ownerId?: string
  ownerUserId?: string | null
  ownerDisplayName?: string | null
  ownerRoomNumber?: string | null
  bundleMemo?: string | null
  freshness?: string | null
  priority?: ItemPriority
  createdAt: string
  updatedAt: string
  removedAt?: string | null
}

export type FilterOptions = {
  tab: "all" | "mine" | "expiring" | "expired"
  slotId?: string
  slotIndex?: number
  searchQuery?: string
  myOnly: boolean
  sortBy: "expiryDate" | "name" | "createdAt"
  sortOrder: "asc" | "desc"
}

export type FridgeStats = {
  totalItems: number
  myItems: number
  expiringItems: number
  expiredItems: number
  bySlot: Record<string, number>
  byStatus: Record<ItemStatus, number>
}

export type InspectionStatus = "IN_PROGRESS" | "SUBMITTED" | "CANCELED" | "CANCELLED"

export type InspectionAction = "PASS" | "WARNING" | "DISCARD" | "DISCARD_WITH_PENALTY"

export type InspectionSummary = {
  action: InspectionAction
  count: number
}

export type Inspection = {
  sessionId?: string
  slotId?: string
  slotIndex?: number
  status?: InspectionStatus
  startedAt?: string
  endedAt?: string
  submittedAt?: string
  submittedBy?: string
  floorCode?: FloorCode
  resourceLabel?: string
  id: string
  dateISO: string
  title?: string
  notes?: string
  completed?: boolean
  completedAt?: string
  completedBy?: string
  results?: InspectionSummary[]
}

export type ActionResult<T = void> = {
  success: boolean
  data?: T
  error?: string
  message?: string
  code?: string
}

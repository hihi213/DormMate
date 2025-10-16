export type ResourceType = "FRIDGE_COMP"

export type ResourceStatus = "ACTIVE" | "OUT_OF_SERVICE"

export type FloorCode = "2F" | "3F" | "4F" | "5F"

export type SlotTemperature = "freezer" | "refrigerator" | "room"

export type Slot = {
  resourceId: number
  code: string
  displayOrder?: number
  labelRangeStart?: number
  labelRangeEnd?: number
  label: string
  floorCode: FloorCode
  type: ResourceType
  status: ResourceStatus
  createdAt: string
  description?: string
  temperature?: SlotTemperature
  capacity?: number | null
  isActive: boolean
}

export type Owner = "me" | "other"

export type ItemStatus = "ok" | "expiring" | "expired"

export type ItemPriority = "low" | "medium" | "high"

export type Bundle = {
  bundleId: string
  resourceId: number
  slotCode: string
  labelNo: number
  labelNumber: number
  labelDisplay: string
  bundleName: string
  memo?: string
  ownerUserId?: number
  ownerDisplayName?: string
  owner?: Owner
  ownerId?: string
  createdAt: string
  updatedAt: string
  removedAt?: string
}

export type ItemUnit = {
  unitId: string
  bundleId: string
  seqNo: number
  name: string
  expiry: string
  quantity?: number
  memo?: string
  priority?: ItemPriority
  createdAt: string
  updatedAt: string
  removedAt?: string
}

// UI 보조용 파생 아이템 타입 (bundle + unit 조합)
export type Item = {
  id: string
  bundleId: string
  unitId: string
  slotCode: string
  resourceId?: number
  labelNo: number
  labelNumber: number
  seqNo: number
  displayCode: string
  bundleLabelDisplay: string
  bundleName: string
  name: string
  expiry: string
  memo?: string
  quantity?: number
  owner?: Owner
  ownerId?: string
  ownerUserId?: number
  bundleMemo?: string
  status?: ItemStatus
  priority?: ItemPriority
  createdAt: string
  updatedAt: string
  removedAt?: string
}

export type FilterOptions = {
  tab: "all" | "mine" | "expiring" | "expired"
  slotCode?: string
  resourceId?: number
  searchQuery?: string
  myOnly: boolean
  sortBy: "expiry" | "name" | "createdAt"
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

export type InspectionStatus = "IN_PROGRESS" | "SUBMITTED" | "CANCELED"

export type InspectionAction = "PASS" | "WARNING" | "DISCARD" | "DISCARD_WITH_PENALTY"

export type InspectionSummary = {
  action: InspectionAction
  count: number
}

export type Inspection = {
  sessionId?: number
  resourceId?: number
  status?: InspectionStatus
  startedAt?: string
  endedAt?: string
  submittedAt?: string
  submittedBy?: number
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
}

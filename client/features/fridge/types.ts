export type ResourceType = "FRIDGE_COMP"

export type ResourceStatus = "ACTIVE" | "OUT_OF_SERVICE"

export type FloorCode = "2F" | "3F" | "4F" | "5F"

export type SlotTemperature = "freezer" | "refrigerator" | "room"

export type Slot = {
  slotId: string
  code: string
  displayOrder?: number | null
  labelRangeStart?: number | null
  labelRangeEnd?: number | null
  label: string
  floor?: number
  floorCode: FloorCode
  type: ResourceType
  status: ResourceStatus
  temperature?: SlotTemperature | null
  capacity?: number | null
  isActive: boolean
}

export type Owner = "me" | "other"

export type ItemStatus = "ok" | "expiring" | "expired"

export type ItemPriority = "low" | "medium" | "high"

export type Bundle = {
  bundleId: string
  slotId?: string
  slotCode: string
  labelNo: number
  labelNumber: number
  labelDisplay: string
  bundleName: string
  memo?: string | null
  ownerUserId?: string | null
  ownerDisplayName?: string | null
  ownerRoomNumber?: string | null
  owner?: Owner
  ownerId?: string
  createdAt: string
  updatedAt: string
  removedAt?: string | null
}

export type ItemUnit = {
  unitId: string
  bundleId: string
  seqNo: number
  name: string
  expiry: string
  quantity?: number | null
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
  slotCode: string
  slotId?: string
  labelNo: number
  labelNumber: number
  seqNo: number
  displayCode: string
  bundleLabelDisplay: string
  bundleName: string
  name: string
  expiry: string
  memo?: string | null
  quantity?: number | null
  owner?: Owner
  ownerId?: string
  ownerUserId?: string | null
  bundleMemo?: string | null
  status?: ItemStatus
  priority?: ItemPriority
  createdAt: string
  updatedAt: string
  removedAt?: string | null
}

export type FilterOptions = {
  tab: "all" | "mine" | "expiring" | "expired"
  slotCode?: string
  slotId?: string
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
  slotId?: string
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

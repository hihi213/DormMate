// 기본 타입들
export type Owner = "me" | "other"

export type ItemStatus = "ok" | "expiring" | "expired"

export type ItemPriority = "low" | "medium" | "high"

// 냉장고 칸 정보
export type Slot = {
  code: string
  label: string
  description?: string
  temperature?: "freezer" | "refrigerator" | "room"
  capacity?: number
  isActive: boolean
}

// 냉장고 물품
export type Item = {
  id: string
  slotCode: string
  label: string
  name: string
  expiry: string
  memo?: string
  owner: Owner
  ownerId?: string
  bundleId?: string
  groupCode?: string
  quantity?: number
  unit?: string
  priority?: ItemPriority
  status?: ItemStatus
  createdAt: number
  updatedAt: number
}

// 묶음 정보
export type Bundle = {
  id: string
  slotCode: string
  name: string
  items: Item[]
  createdAt: number
  updatedAt: number
}

// 필터 옵션
export type FilterOptions = {
  tab: "all" | "mine" | "expiring" | "expired"
  slotCode?: string
  searchQuery?: string
  myOnly: boolean
  sortBy: "expiry" | "name" | "createdAt"
  sortOrder: "asc" | "desc"
}

// 통계 정보
export type FridgeStats = {
  totalItems: number
  myItems: number
  expiringItems: number
  expiredItems: number
  bySlot: Record<string, number>
  byStatus: Record<ItemStatus, number>
}

// 검사 관련
export type Inspection = {
  id: string
  dateISO: string
  title?: string
  notes?: string
  completed?: boolean
  completedAt?: string
  completedBy?: string
  results?: {
    passed: number
    warned: number
    discarded: number
  }
}

// 액션 결과
export type ActionResult<T = void> = {
  success: boolean
  data?: T
  error?: string
  message?: string
}

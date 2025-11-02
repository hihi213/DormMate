export type AdminSummaryCard = {
  id: string
  label: string
  value: string
  description: string
}

export type AdminTimelineEvent = {
  id: string
  time: string
  title: string
  detail: string
}

export type AdminQuickAction = {
  id: string
  title: string
  description: string
  href: string
  icon: string
}

export type AdminResource = {
  id: string
  facility: "fridge" | "laundry" | "library" | "multipurpose"
  name: string
  location: string
  status: "ACTIVE" | "SUSPENDED" | "REPORTED" | "RETIRED"
  capacity: string
  manager: string
  rooms: string
  labelRange?: string
  issue?: string
  lastInspection?: string
}

export type AdminUser = {
  id: string
  name: string
  room: string
  role: "RESIDENT" | "FLOOR_MANAGER" | "ADMIN"
  status: "ACTIVE" | "INACTIVE"
  lastLogin: string
  inspectionsInProgress?: number
  penalties?: number
}

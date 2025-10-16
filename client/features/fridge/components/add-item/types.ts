export type TemplateState = {
  slotCode: string
  name: string
  expiry: string
  qty: number
  lockName: boolean
}

export type PendingEntry = {
  id: string
  name: string
  expiry: string
  qty: number
}

export type DetailRowState = {
  name: string
  expiry: string
  customName: boolean
  customExpiry: boolean
}

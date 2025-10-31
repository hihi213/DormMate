export type TemplateState = {
  slotId: string
  name: string
  expiryDate: string
  qty: number
  lockName: boolean
}

export type PendingEntry = {
  id: string
  name: string
  expiryDate: string
  qty: number
}

export type DetailRowState = {
  name: string
  expiryDate: string
  customName: boolean
  customExpiry: boolean
}

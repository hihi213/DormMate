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

export const CONSTANTS = {
  MAX_NAME: 20,
  MAX_QTY: 50,
  WARNING_EXPIRY_DAYS: 2
} as const

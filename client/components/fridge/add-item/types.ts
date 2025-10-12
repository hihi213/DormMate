export type DetailRowState = {
  name: string
  customName: boolean // 사용자가 직접 수정한 세부물품명인지 여부
  customExpiry: boolean
  expiry: string
}

export type FormState = {
  slotCode: string
  name: string
  expiry: string
  memo: string
  qty: number
}

export type DialogState = {
  slotOpen: boolean
  detailsOpen: boolean
  confirmOpen: boolean
}

export type ConfirmState = {
  code: string
  isBundle: boolean
  qty: number
}

export const CONSTANTS = {
  MAX_NAME: 20,
  MAX_QTY: 50,
  DEFAULT_EXPIRY_DAYS: 7,
  WARNING_EXPIRY_DAYS: 2
} as const

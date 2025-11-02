import type { Slot } from "@/features/fridge/types"
import { formatSlotDisplayName } from "@/features/fridge/utils/labels"
import { getDefaultErrorMessage } from "@/lib/api-errors"

export function buildCapacityExceededMessage(slot?: Slot | null): string {
  const slotLabel = slot ? formatSlotDisplayName(slot) : "선택한 칸"
  const capacity = slot?.capacity
  const fallback = capacity
    ? `${slotLabel} 칸은 최대 ${capacity}개 포장을 보관할 수 있습니다. 기존 포장을 정리하거나 다른 칸을 선택해 주세요.`
    : `${slotLabel}의 허용량을 초과했습니다. 다른 칸을 선택하거나 기존 포장을 정리해 주세요.`

  const dictionaryMessage = getDefaultErrorMessage("CAPACITY_EXCEEDED")
  if (dictionaryMessage) {
    if (dictionaryMessage.includes("{slot}") || dictionaryMessage.includes("{capacity}")) {
      return dictionaryMessage
        .replace("{slot}", slotLabel)
        .replace("{capacity}", capacity != null ? String(capacity) : "")
    }
    return dictionaryMessage
  }

  return fallback
}

export function buildSlotUnavailableMessage({
  slot,
  actionClause,
  fallbackMessage,
  code,
  message,
}: {
  slot?: Slot | null
  actionClause: string
  fallbackMessage?: string
  code?: string
  message?: string
}): string {
  const slotLabel = slot ? formatSlotDisplayName(slot) : "해당 칸"
  const fallback = fallbackMessage ?? `현재 ${slotLabel}을 사용할 수 없어 ${actionClause}`

  if (message && message.trim().length > 0 && !/^[A-Z0-9_]+$/.test(message.trim())) {
    return message
  }

  const effectiveCode = code ?? message?.trim()
  const dictionaryMessage = effectiveCode ? getDefaultErrorMessage(effectiveCode) : undefined
  if (dictionaryMessage) {
    return dictionaryMessage.replace("{slot}", slotLabel)
  }

  switch (effectiveCode) {
    case "COMPARTMENT_SUSPENDED":
      return `관리자 점검 중인 ${slotLabel}에서는 ${actionClause}`
    case "COMPARTMENT_LOCKED":
    case "COMPARTMENT_UNDER_INSPECTION":
      return `검사 중인 ${slotLabel}에서는 ${actionClause}`
    default:
      return fallback
  }
}

import { formatBundleLabel, toSlotLetter } from "@/features/fridge/utils/data-shaping"
import type { CompartmentType, Slot } from "@/features/fridge/types"

const COMPARTMENT_TYPE_LABEL: Record<CompartmentType, string> = {
  CHILL: "냉장",
  FREEZE: "냉동",
}

export const formatCompartmentTypeLabel = (type: CompartmentType): string => COMPARTMENT_TYPE_LABEL[type]

export const formatSlotName = (slotLetter: string, type?: CompartmentType): string =>
  type ? `${formatCompartmentTypeLabel(type)}(${slotLetter})` : slotLetter

export const formatCompartmentLabel = (slotIndex: number, type?: CompartmentType): string =>
  formatSlotName(toSlotLetter(slotIndex), type)

export const formatSlotDisplayName = (slot: Pick<Slot, "slotIndex" | "slotLetter" | "compartmentType">): string => {
  const letter =
    slot.slotLetter && slot.slotLetter.length > 0 ? slot.slotLetter : toSlotLetter(slot.slotIndex)
  return formatSlotName(letter, slot.compartmentType)
}

export const formatStickerLabel = (slotIndex: number, labelNumber: number): string =>
  formatBundleLabel(slotIndex, labelNumber)

export const formatStickerWithSequence = (slotIndex: number, labelNumber: number, seqNo: number): string => {
  const base = formatStickerLabel(slotIndex, labelNumber)
  return `${base}-${String(seqNo).padStart(2, "0")}`
}

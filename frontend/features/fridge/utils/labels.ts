import { formatBundleLabel, toSlotLetter } from "@/features/fridge/utils/data-shaping"

export const formatCompartmentLabel = (slotIndex: number): string => toSlotLetter(slotIndex)

export const formatStickerLabel = (slotIndex: number, labelNumber: number): string =>
  formatBundleLabel(slotIndex, labelNumber)

export const formatStickerWithSequence = (slotIndex: number, labelNumber: number, seqNo: number): string => {
  const base = formatStickerLabel(slotIndex, labelNumber)
  return `${base}-${String(seqNo).padStart(2, "0")}`
}

import { z } from "zod"
import { toYMD } from "@/lib/date-utils"
import type { TemplateState, PendingEntry } from "./types"
import { CONSTANTS } from "./types"

const todayISO = toYMD(new Date())

const expirySchema = z
  .string()
  .min(1, "유통기한을 선택해 주세요.")
  .refine((value) => value >= todayISO, "오늘 이후 날짜를 선택해 주세요.")

const templateSchema = z.object({
  slotCode: z.string().min(1, "보관 칸을 선택해 주세요."),
  name: z
    .string()
    .transform((val) => val.trim())
    .pipe(z.string().min(1, "물품(묶음)명을 입력해 주세요.").max(CONSTANTS.MAX_NAME)),
  expiry: expirySchema,
  qty: z.number().int().min(1, "수량은 1개 이상이어야 합니다.").max(CONSTANTS.MAX_QTY, `최대 ${CONSTANTS.MAX_QTY}개까지 등록할 수 있습니다.`),
})

export function validateTemplate(
  template: TemplateState,
  toast: (message: { title: string; description: string }) => void
): boolean {
  const baseValidation = templateSchema.safeParse(template)
  if (!baseValidation.success) {
    const issue = baseValidation.error.issues[0]
    toast({
      title: "입력값을 확인해 주세요.",
      description: issue?.message ?? "폼 입력값에 오류가 있습니다.",
    })
    return false
  }

  return true
}

export function summarizeEntries(entries: PendingEntry[]) {
  return entries.reduce(
    (acc, entry) => {
      acc.totalItems += 1
      acc.totalQuantity += entry.qty
      return acc
    },
    { totalItems: 0, totalQuantity: 0 }
  )
}

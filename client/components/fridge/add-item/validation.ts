import type { FormState, DetailRowState } from "./types"
import { CONSTANTS } from "./types"

export function validateForm(
  formState: FormState, 
  rows: DetailRowState[],
  toast: (message: { title: string; description: string }) => void
): boolean {
  if (!formState.slotCode) {
    toast({ title: "칸 선택", description: "보관 칸을 선택해 주세요." })
    return false
  }
  
  if (!formState.name.trim()) {
    toast({ title: "대표 물품명 필요", description: "물품(묶음)명을 입력해 주세요." })
    return false
  }
  
  if (!formState.expiry) {
    toast({ title: "유통기한 필요", description: "유통기한을 선택해 주세요." })
    return false
  }
  
  if (formState.qty > CONSTANTS.MAX_QTY) {
    toast({ 
      title: "수량 제한", 
      description: `한 번에 등록 가능한 최대 수량은 ${CONSTANTS.MAX_QTY}개입니다.` 
    })
    return false
  }
  
  if (formState.qty >= 2) {
    const invalidIndex = rows.findIndex(r => r.customExpiry && !r.expiry)
    if (invalidIndex >= 0) {
      toast({ 
        title: "세부 유통기한 필요", 
        description: `${invalidIndex + 1}번 세부 항목의 유통기한을 선택해 주세요.` 
      })
      return false
    }
  }
  
  return true
}

export function ensureRows(qty: number, repName: string, repExpiry: string): DetailRowState[] {
  const count = Math.min(qty, CONSTANTS.MAX_QTY)
  const newRows: DetailRowState[] = []
  
  for (let i = 0; i < count; i++) {
    newRows.push({ 
      name: repName, 
      customName: false, // 기본 물품명 사용
      customExpiry: false, 
      expiry: repExpiry 
    })
  }
  
  return newRows
}

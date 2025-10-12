"use client"

import { useMemo } from "react"
import { CalendarDays, Edit, Check } from "lucide-react"
import { Label } from "@/components/ui/label"
import FloatingInput from "@/components/shared/floating-input"
import QuantityStepper from "@/components/shared/quantity-stepper"
import { SlotSelector } from "@/components/fridge/slot-selector"
import { addDays, clampToToday, ddayInlineLabel, daysDiffFromToday, toYMD } from "@/lib/date-utils"
import type { Slot } from "../types"

// 상수 정의
const CONSTANTS = {
  MAX_NAME: 20,
  MAX_QTY: 50,
  DEFAULT_EXPIRY_DAYS: 7,
  WARNING_EXPIRY_DAYS: 2,
  MAX_MEMO: 100
} as const

interface FormFieldsProps {
  formState: {
    slotCode: string
    name: string
    expiry: string
    memo: string
    qty: number
  }
  slots: Slot[]
  dialogState: {
    slotOpen: boolean
    detailsOpen: boolean
  }
  onFormStateChange: (updates: Partial<FormFieldsProps['formState']>) => void
  onDialogStateChange: (updates: Partial<{ slotOpen: boolean; detailsOpen: boolean }>) => void
  onQuantityChange: (qty: number) => void
  onExpiryChange: (expiry: string) => void
  toast: (message: { title: string; description: string }) => void
}

export function FormFields({
  formState,
  slots,
  dialogState,
  onFormStateChange,
  onDialogStateChange,
  onQuantityChange,
  onExpiryChange,
  toast
}: FormFieldsProps) {
  const currentSlotLabel = useMemo(() => {
    const slot = slots.find(s => s.code === formState.slotCode)
    return slot ? `${slot.label} (${slot.code})` : "칸 선택"
  }, [formState.slotCode, slots])

  const expiryInfo = useMemo(() => {
    if (!formState.expiry) return { diff: null, text: "", color: "text-gray-600" }
    
    const diff = daysDiffFromToday(formState.expiry)
    const text = ddayInlineLabel(diff)
    let color = "text-gray-600"
    
    if (diff < 0) color = "text-rose-600"
    else if (diff <= CONSTANTS.WARNING_EXPIRY_DAYS) color = "text-amber-600"
    else color = "text-emerald-700"
    
    return { diff, text, color }
  }, [formState.expiry])

  const handleSlotSelect = (slotCode: string) => {
    onFormStateChange({ slotCode })
    onDialogStateChange({ slotOpen: false })
  }

  const handleQuantityChange = (qty: number) => {
    onQuantityChange(qty)
    
    if (qty === CONSTANTS.MAX_QTY) {
      toast({ 
        title: "수량 제한", 
        description: `최대 ${CONSTANTS.MAX_QTY}개까지 등록할 수 있습니다.` 
      })
    }
  }

  return (
    <div className="space-y-4">
      {/* 칸 선택 */}
      <div className="min-w-0">
        <Label htmlFor="slot" className="text-sm font-medium text-gray-700 mb-2">
          {"칸"}
        </Label>
        <SlotSelector
          value={formState.slotCode}
          onChange={handleSlotSelect}
          slots={slots}
          showAllOption={false}
        />
        <div className="text-xs text-muted-foreground mt-1">
          {"현재 선택된 칸에 물품이 등록됩니다."}
        </div>
      </div>

      {/* 물품명 */}
      <div className="min-w-0 w-full">
        <Label htmlFor="name" className="text-sm font-medium text-gray-700 mb-2">
          {formState.qty === 1 ? "물품명" : "묶음명"}
        </Label>

        <FloatingInput
          id="name"
          label=""
          value={formState.name}
          maxLength={CONSTANTS.MAX_NAME}
          onChange={(e) => onFormStateChange({ name: e.target.value.slice(0, CONSTANTS.MAX_NAME) })}
          placeholder={formState.qty === 1 ? "물품명을 입력하세요" : "묶음명을 입력하세요"}
          rightAdornment={
            <div className="flex items-center gap-2">
              <span
                className={`text-[11px] ${
                  formState.name.length >= CONSTANTS.MAX_NAME ? "text-rose-600 font-medium" : "text-muted-foreground"
                }`}
              >
                {`${formState.name.length}/${CONSTANTS.MAX_NAME}`}
              </span>
              {formState.qty >= 2 && (
                <span className="pointer-events-none text-[11px] rounded-md border bg-white px-1.5 py-0.5 text-gray-500">
                  {"묶음"}
                </span>
              )}
            </div>
          }
        />
      </div>

      {/* 유통기한 */}
      <div className="grid gap-2">
        <div className="flex items-center gap-2">
          <Label htmlFor="expiry" className="flex-1">
            {"유통기한 "}
            <span className="text-xs text-muted-foreground">
              {formState.qty > 1 ? "(대표, 기본값)" : "(필수)"}
            </span>
          </Label>
          <div className={`inline-flex items-center gap-1 text-sm ${expiryInfo.color}`}>
            <CalendarDays className="w-4 h-4" />
            <span>{expiryInfo.text}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            id="expiry"
            type="date"
            min={toYMD(new Date())}
            value={formState.expiry}
            onChange={(e) => onExpiryChange(clampToToday(e.target.value))}
            className="h-10 min-w-0 flex-1 rounded-md border px-3 py-2 text-sm"
          />
          <button
            className="inline-flex items-center rounded-md border px-3 h-10 text-sm bg-transparent hover:bg-gray-50"
            onClick={() => onExpiryChange(toYMD(new Date()))}
            aria-label="오늘로 설정"
            title="오늘로 설정"
          >
            {"오늘"}
          </button>
          <button
            className="inline-flex items-center rounded-md border px-3 h-10 text-sm bg-transparent hover:bg-gray-50"
            onClick={() => onExpiryChange(toYMD(addDays(new Date(), 1)))}
            aria-label="+1일로 설정"
            title="+1일로 설정"
          >
            {"+1"}
          </button>
          <button
            className="inline-flex items-center rounded-md border px-3 h-10 text-sm bg-transparent hover:bg-gray-50"
            onClick={() => onExpiryChange(toYMD(addDays(new Date(), CONSTANTS.DEFAULT_EXPIRY_DAYS)))}
            aria-label="+7일로 설정"
            title="+7일로 설정"
          >
            {"+7"}
          </button>
        </div>
      </div>

      {/* 수량 + 개별 변경 */}
      <div className="min-w-0 w-full">
        <div className="flex items-center justify-between mb-2">
          <Label className="text-sm">{"수량"}</Label>
          <span className="text-xs text-muted-foreground">{`최대 ${CONSTANTS.MAX_QTY}`}</span>
        </div>
        
        <div className="flex items-center gap-4">
          <QuantityStepper
            value={formState.qty}
            min={1}
            max={CONSTANTS.MAX_QTY}
            onChange={handleQuantityChange}
            onLimitReach={(which) => {
              if (which === "max") {
                toast({ 
                  title: "수량 제한", 
                  description: `최대 ${CONSTANTS.MAX_QTY}개까지 등록할 수 있습니다.` 
                })
              }
            }}
            className="w-auto"
          />
          
          {formState.qty > 1 && (
            <button
              type="button"
              onClick={() => onDialogStateChange({ detailsOpen: true })}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              <Edit className="w-4 h-4" />
              {"개별 변경"}
            </button>
          )}
        </div>
      </div>

      {/* 메모 */}
      <div className="min-w-0 w-full">
        <Label htmlFor="memo" className="text-sm font-medium text-gray-700 mb-2">
          {"메모(선택)"}
        </Label>
        <FloatingInput
          id="memo"
          label=""
          value={formState.memo}
          maxLength={CONSTANTS.MAX_MEMO}
          onChange={(e) => onFormStateChange({ memo: e.target.value.slice(0, CONSTANTS.MAX_MEMO) })}
          placeholder="본인만 확인가능"
          rightAdornment={
            <span
              className={`text-[11px] ${formState.memo.length >= CONSTANTS.MAX_MEMO ? "text-rose-600 font-medium" : "text-muted-foreground"}`}
              aria-live="polite"
            >
              {`${formState.memo.length}/${CONSTANTS.MAX_MEMO}`}
            </span>
          }
        />
      </div>
    </div>
  )
}

function SlotOption({
  label,
  selected = false,
  onSelect = () => {},
}: {
  label: string
  selected?: boolean
  onSelect?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-gray-50 ${selected ? "bg-emerald-50" : ""}`}
      aria-pressed={selected}
    >
      <span className="truncate mr-2">{label}</span>
      <Check className={`w-4 h-4 text-emerald-600 ${selected ? "opacity-100" : "opacity-0"}`} aria-hidden="true" />
    </button>
  )
}

"use client"

import { useEffect, useRef, useState, useMemo, useCallback } from "react"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { useFridge } from "../fridge-context"
import { useToast } from "@/hooks/use-toast"
import RegistrationCompleteDialog from "../registration-complete-dialog"
import { PrimaryButton } from "@/components/shared/buttons"
import { toYMD } from "@/lib/date-utils"
import { isBundleMode } from "@/lib/fridge-logic"
import { FormFields } from "./form-fields"
import { BundleDetails } from "./bundle-details"
import { validateForm, ensureRows } from "./validation"
import type { FormState, DialogState, ConfirmState, DetailRowState } from "./types"
import type { Slot } from "../types"

export default function AddItemDialog({
  open = false,
  onOpenChange = () => {},
  slots = [],
  currentSlotCode = "",
}: {
  open?: boolean
  onOpenChange?: (v: boolean) => void
  slots?: Slot[]
  currentSlotCode?: string
}) {
  const { addItem, addBundle } = useFridge()
  const { toast } = useToast()
  const contentRef = useRef<HTMLDivElement | null>(null)

  // 통합된 상태 관리
  const [formState, setFormState] = useState<FormState>({
    slotCode: currentSlotCode || slots[0]?.code || "",
    name: "",
    expiry: "",
    memo: "",
    qty: 1
  })

  const [dialogState, setDialogState] = useState<DialogState>({
    slotOpen: false,
    detailsOpen: false,
    confirmOpen: false
  })

  const [confirmState, setConfirmState] = useState<ConfirmState>({
    code: "",
    isBundle: false,
    qty: 1
  })

  const [rows, setRows] = useState<DetailRowState[]>([])
  const prevRepNameRef = useRef<string>("")

  // 계산된 값들
  const inBundle = useMemo(() => 
    isBundleMode(formState.slotCode, formState.name, formState.expiry, formState.qty),
    [formState.slotCode, formState.name, formState.expiry, formState.qty]
  )

  const modifiedCount = useMemo(() => 
    rows.filter(r => 
      r.name.trim() !== formState.name.trim() || r.customExpiry
    ).length,
    [rows, formState.name]
  )

  // 상태 업데이트 함수들
  const updateFormState = useCallback((updates: Partial<FormState>) => {
    setFormState(prev => ({ ...prev, ...updates }))
  }, [])

  const updateDialogState = useCallback((updates: Partial<DialogState>) => {
    setDialogState(prev => ({ ...prev, ...updates }))
  }, [])

  const resetForm = useCallback(() => {
    setFormState({
      slotCode: currentSlotCode || slots[0]?.code || "",
      name: "",
      expiry: toYMD(new Date()),
      memo: "",
      qty: 1
    })
    setRows([])
    setDialogState({
      slotOpen: false,
      detailsOpen: false,
      confirmOpen: false
    })
    prevRepNameRef.current = ""
  }, [currentSlotCode, slots])

  // 행 관리 함수들
  const updateRow = useCallback((index: number, updates: Partial<DetailRowState>) => {
    setRows(prev => {
      const next = [...prev]
      next[index] = { ...next[index], ...updates }
      return next
    })
  }, [])

  // 유효성 검사
  const validateFormData = useCallback(() => {
    return validateForm(formState, rows, toast)
  }, [formState, rows, toast])

  // 등록 처리
  const handleRegister = useCallback(async () => {
    if (!validateFormData()) return

    try {
      if (formState.qty <= 1) {
        // 단일 아이템 등록
        const result = addItem({
          slotCode: formState.slotCode,
          name: formState.name,
          expiry: formState.expiry,
          memo: formState.memo || undefined,
        })

        if (result.success && result.data) {
          setConfirmState({
            code: result.data.id,
            isBundle: false,
            qty: 1
          })
          updateDialogState({ confirmOpen: true })
          onOpenChange(false)
        } else {
          toast({ 
            title: "등록 실패", 
            description: result.error || "물품 등록 중 오류가 발생했습니다." 
          })
        }
        return
      }

      if (inBundle) {
        // 묶음 등록
        const details = rows.map(r => ({
          name: r.name.trim(),
          expiry: r.customExpiry ? r.expiry : formState.expiry,
        }))

        const result = addBundle({
          slotCode: formState.slotCode,
          bundleName: formState.name.trim(),
          memo: formState.memo || undefined,
          details,
        })

        if (result.success && result.data) {
          setConfirmState({
            code: result.data.bundleCode,
            isBundle: true,
            qty: result.data.ids.length
          })
          updateDialogState({ confirmOpen: true })
          onOpenChange(false)
        } else {
          toast({ 
            title: "등록 실패", 
            description: result.error || "묶음 등록 중 오류가 발생했습니다." 
          })
        }
      }
    } catch (error) {
      toast({ 
        title: "등록 실패", 
        description: "예상치 못한 오류가 발생했습니다." 
      })
      console.error("Registration error:", error)
    }
  }, [formState, rows, inBundle, addItem, addBundle, validateFormData, onOpenChange, toast])

  // 이벤트 핸들러들
  const handleQuantityChange = useCallback((qty: number) => {
    updateFormState({ qty })
    
    if (qty >= 2) {
      const newRows = ensureRows(qty, formState.name, formState.expiry)
      setRows(newRows)
      // 자동으로 개별변경화면을 열지 않음
    } else {
      setRows([])
      updateDialogState({ detailsOpen: false })
    }
  }, [formState.name, formState.expiry, updateFormState, updateDialogState])

  const handleExpiryChange = useCallback((expiry: string) => {
    updateFormState({ expiry })
    
    // 묶음 모드에서 기본 유통기한이 변경되면 모든 행 업데이트
    if (formState.qty >= 2) {
      setRows(prev => prev.map(row => ({
        ...row,
        expiry: row.customExpiry ? row.expiry : expiry
      })))
    }
  }, [formState.qty, updateFormState])

  // 초기화 및 정리
  useEffect(() => {
    if (!open) {
      resetForm()
    } else {
      if (!formState.slotCode) {
        updateFormState({ slotCode: currentSlotCode || slots[0]?.code || "" })
      }
      if (!formState.expiry) {
        updateFormState({ expiry: toYMD(new Date()) })
      }
      if (formState.qty >= 2) {
        const newRows = ensureRows(formState.qty, formState.name, formState.expiry)
        setRows(newRows)
      }
      prevRepNameRef.current = formState.name
    }
  }, [open, currentSlotCode, slots, formState.slotCode, formState.expiry, formState.qty, formState.name, resetForm, updateFormState])

  // 이름 변경 시 행 업데이트 - 기존 사용자 입력값은 유지
  useEffect(() => {
    if (!open) return
    
    const prev = prevRepNameRef.current
    const now = formState.name
    
    if (prev === now) return
    
    // 물품명이 변경되어도 기존에 사용자가 입력한 세부물품명은 유지
    // 단, 물품명과 동일했던 행만 새로운 물품명으로 업데이트
    setRows(prevRows => 
      prevRows.map(row => {
        // 이전 물품명과 동일했던 행만 새로운 물품명으로 업데이트
        // 사용자가 직접 수정한 세부물품명은 유지
        if (row.name === prev && !row.customName) {
          return { ...row, name: now }
        }
        return row
      })
    )
    prevRepNameRef.current = now
  }, [formState.name, open])

  // 닫기 버튼 숨기기
  useEffect(() => {
    if (!open) return
    
    const root = contentRef.current
    if (!root) return
    
    const selectors = [
      "button.absolute.right-4.top-4",
      "button[aria-label='Close']",
      "button[title='Close']",
      "button[data-dialog-close]",
    ]
    
    selectors.forEach(selector => {
      root.querySelectorAll(selector).forEach(el => {
        (el as HTMLElement).style.display = "none"
      })
    })
  }, [open])

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          ref={contentRef}
          className={`transition-all duration-300 ease-in-out p-0 overflow-hidden [&>button.absolute.right-4.top-4]:hidden [&_button[aria-label='Close']]:hidden [&_[aria-label='Close']]:hidden [&_button[title='Close']]:hidden ${
            dialogState.detailsOpen 
              ? "w-screen h-screen max-w-none rounded-none border-0" 
              : "w-[90vw] max-w-lg"
          }`}
        >
          <DialogTitle className="sr-only">
            {"냉장고 물품 등록"}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {"냉장고 물품을 등록하는 폼입니다. 칸, 물품명, 수량, 유통기한, 메모를 입력하세요."}
          </DialogDescription>

          <div className="flex max-h-[85svh] flex-col">
            {/* Sticky top: header + representative fields */}
            <div className="sticky top-0 z-20 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/70 border-b">
              <div className="px-4 py-3 flex items-center justify-between gap-2">
                <button
                  className="inline-flex items-center justify-center w-8 h-8 rounded-md border bg-transparent hover:bg-gray-50"
                  aria-label="닫기"
                  onClick={() => {
                    if (dialogState.detailsOpen) {
                      updateDialogState({ detailsOpen: false })
                    } else {
                      onOpenChange(false)
                    }
                  }}
                >
                  <X className="w-4 h-4" />
                </button>
                <div className="text-base font-semibold">
                  {dialogState.detailsOpen ? "개별 변경" : "물품 등록"}
                </div>
                {!dialogState.detailsOpen && (
                  <PrimaryButton onClick={handleRegister} aria-label="등록" size="sm">
                    {"등록"}
                  </PrimaryButton>
                )}
              </div>

              {!dialogState.detailsOpen && (
                <div className="px-4 pb-4">
                  <FormFields
                    formState={formState}
                    slots={slots}
                    dialogState={dialogState}
                    onFormStateChange={updateFormState}
                    onDialogStateChange={updateDialogState}
                    onQuantityChange={handleQuantityChange}
                    onExpiryChange={handleExpiryChange}
                    toast={toast}
                  />
                </div>
              )}
            </div>

            {/* Scrollable: details list and footer notes */}
            <div className="flex-1 overflow-y-auto">
              {dialogState.detailsOpen ? (
                /* 개별 변경 화면 */
                <div className="px-4 py-6">
                  <BundleDetails
                    name={formState.name}
                    expiry={formState.expiry}
                    rows={rows}
                    onRowUpdate={updateRow}
                    detailsOpen={true}
                    onToggleDetails={() => {}}
                  />
                </div>
              ) : (
                /* 기본 등록 화면 */
                <div className="px-4 py-4">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>
                      {formState.qty === 1
                        ? "등록 시 칸별 중복 없는 3자리 번호가 자동 배정됩니다."
                        : `수량이 2 이상이면 목록이 생성되며(최대 50개), 개별 변경 버튼을 눌러 세부사항을 수정할 수 있습니다.`}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* 개별 변경 화면 하단 버튼 */}
            {dialogState.detailsOpen && (
              <div className="border-t bg-white p-6">
                <div className="flex gap-3">
                  <Button 
                    variant="outline" 
                    onClick={() => updateDialogState({ detailsOpen: false })}
                    className="flex-1 h-11"
                  >
                    {"뒤로"}
                  </Button>
                  <Button 
                    onClick={() => updateDialogState({ detailsOpen: false })}
                    className="flex-1 h-11"
                  >
                    {"완료"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <RegistrationCompleteDialog
        open={dialogState.confirmOpen}
        onOpenChange={(open) => updateDialogState({ confirmOpen: open })}
        code={confirmState.code}
        qty={confirmState.qty}
        isBundle={confirmState.isBundle}
      />
    </>
  )
}

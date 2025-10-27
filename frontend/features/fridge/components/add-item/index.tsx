"use client"

import { useCallback, useRef } from "react"
import type { TouchEvent } from "react"
import { X, Trash2, ArrowLeft, Pencil, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import { FormFields } from "./form-fields"
import type { Slot } from "@/features/fridge/types"
import { useFridge } from "@/features/fridge/hooks/fridge-context"
import type { PendingEntry } from "./types"
import { SlotSelector } from "../slot-selector"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useAddItemWorkflow, formatExpiryDisplay } from "./use-add-item-workflow"

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
  const { addBundle } = useFridge()
  const { toast } = useToast()
  const fallbackSlot = currentSlotCode || slots[0]?.code || ""

  const closeDialog = useCallback(() => onOpenChange(false), [onOpenChange])

  const {
    template,
    entries,
    packName,
    packMemo,
    isMetadataStep,
    metadataSlot,
    nameFlash,
    editingEntryId,
    revealedId,
    summary,
    nameInputRef,
    setPackName,
    setPackMemo,
    setMetadataSlot,
    setRevealedId,
    handleTemplateChange,
    handleSubmitForm,
    handleRemoveEntry,
    handleNameLimit,
    handleQuantityLimit,
    handleEditEntry,
    handleRequestSave,
    handleConfirmSave,
    isSaving,
    handleBackToItems,
    handleCancel,
  } = useAddItemWorkflow({
    fallbackSlot,
    toast,
    addBundle,
    open,
    onClose: closeDialog,
  })

  const isEditing = editingEntryId !== null
  const touchRef = useRef<{ id: string | null; startX: number }>({ id: null, startX: 0 })

  const handleRowTouchStart = useCallback(
    (id: string, event: TouchEvent<HTMLDivElement>) => {
      const touch = event.touches[0]
      if (!touch) return
      touchRef.current = { id, startX: touch.clientX }
    },
    [],
  )

  const handleRowTouchMove = useCallback(
    (id: string, event: TouchEvent<HTMLDivElement>) => {
      const touch = event.touches[0]
      if (!touch || touchRef.current.id !== id) return
      const delta = touch.clientX - touchRef.current.startX
      if (delta > 30) setRevealedId(id)
      else if (delta < -30) setRevealedId(null)
    },
    [setRevealedId],
  )

  const handleRowTouchEnd = useCallback(() => {
    touchRef.current = { id: null, startX: 0 }
  }, [])

  const stepLabel = isMetadataStep ? "2 / 2" : "1 / 2"
  const headerTitle = isMetadataStep ? "포장 정보 입력" : "포장 목록"
  const primaryActionLabel = isMetadataStep ? "보관" : "다음"
  const isPrimaryDisabled = isMetadataStep ? isSaving || entries.length === 0 || !metadataSlot : entries.length === 0
  const handlePrimaryAction = isMetadataStep ? () => void handleConfirmSave() : handleRequestSave

  const readOnly = isMetadataStep
  const hasEntries = entries.length > 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl h-[86vh] max-h-[90vh] flex flex-col gap-0 overflow-hidden p-0" showCloseButton={false}>
        <DialogTitle className="sr-only">포장 아이템 추가</DialogTitle>
        <DialogDescription className="sr-only">냉장고 포장 등록 대화상자입니다.</DialogDescription>
        <header className="flex items-center gap-2 bg-white px-3 py-2">
          <Button
            variant="ghost"
            size="icon"
            aria-label={isMetadataStep ? "포장 목록으로 돌아가기" : "닫기"}
            onClick={isMetadataStep ? handleBackToItems : handleCancel}
          >
            {isMetadataStep ? <ArrowLeft className="h-5 w-5" /> : <X className="h-5 w-5" />}
          </Button>
          <div className="flex-1 text-center text-sm font-semibold text-gray-900">{headerTitle}</div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-emerald-700">{stepLabel}</span>
            <Button
              onClick={handlePrimaryAction}
              disabled={isPrimaryDisabled}
              className="inline-flex items-center gap-2 rounded-md bg-gradient-to-r from-emerald-700 to-teal-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:from-emerald-600 hover:to-teal-500 disabled:from-gray-200 disabled:to-gray-200 disabled:text-gray-500"
              data-loading={isSaving && isMetadataStep}
            >
              {isMetadataStep && isSaving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              {primaryActionLabel}
            </Button>
          </div>
        </header>

        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-3 text-xs text-muted-foreground">
          <Badge variant="secondary" className="bg-emerald-100 text-emerald-800">
            품목 {summary.totalItems}
          </Badge>
          <Badge variant="outline" className="border-emerald-200 text-emerald-700">
            수량 {summary.totalQuantity}
          </Badge>
        </div>

        <section className="flex-1 min-h-0 overflow-y-auto bg-slate-50 px-3 py-3">
          {hasEntries ? (
            entries.map((entry, index) => {
              const isRevealed = !readOnly && revealedId === entry.id

              return (
                <article
                  key={entry.id}
                  className={cn(
                    "relative overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm",
                    index > 0 && "mt-2",
                  )}
                >
                  {!readOnly && (
                    <div className="absolute inset-y-0 left-0 flex items-center pl-2">
                      <Button
                        variant="destructive"
                        size="icon"
                        aria-label="항목 삭제"
                        onClick={() => {
                          handleRemoveEntry(entry.id)
                          setRevealedId(null)
                        }}
                        className="h-9 w-9"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                  <div
                    className={cn(
                      "flex items-center gap-3 bg-white px-3 py-3 transition-transform",
                      isRevealed ? "translate-x-[64px]" : "translate-x-0",
                    )}
                    onTouchStart={readOnly ? undefined : (event) => handleRowTouchStart(entry.id, event)}
                    onTouchMove={readOnly ? undefined : (event) => handleRowTouchMove(entry.id, event)}
                    onTouchEnd={readOnly ? undefined : handleRowTouchEnd}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-900">{entry.name}</p>
                      <p className="text-xs text-muted-foreground">
                        유통기한 {formatExpiryDisplay(entry.expiry)} <span className="ml-1 text-emerald-600">x{entry.qty}</span>
                      </p>
                    </div>
                    {!readOnly && (
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="항목 수정"
                        onClick={() => {
                          setRevealedId(null)
                          handleEditEntry(entry)
                        }}
                        className="text-slate-600 hover:bg-slate-100"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </article>
              )
            })
          ) : (
            <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-emerald-200 bg-emerald-50 px-2.5 py-4 text-center text-sm text-muted-foreground">
              아직 담긴 품목이 없습니다. 아래에서 품목을 입력해 포장을 시작해 보세요.
            </div>
          )}
        </section>

        <div className="border-t bg-white px-3 pt-2" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)" }}>
          {isMetadataStep ? (
            <MetadataFields
              slots={slots}
              slotCode={metadataSlot}
              packName={packName}
              packMemo={packMemo}
              onChangeSlot={setMetadataSlot}
              onChangeName={setPackName}
              onChangeMemo={setPackMemo}
            />
          ) : (
            <FormFields
              template={template}
              onTemplateChange={handleTemplateChange}
              onQuantityChange={(qty) => handleTemplateChange({ qty })}
              onExpiryChange={(expiry) => handleTemplateChange({ expiry })}
              onSubmit={handleSubmitForm}
              nameInputRef={nameInputRef}
              highlightName={nameFlash}
              onNameLimit={handleNameLimit}
              onQuantityLimit={handleQuantityLimit}
              isEditing={isEditing}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function MetadataFields({
  slots,
  slotCode,
  packName,
  packMemo,
  onChangeSlot,
  onChangeName,
  onChangeMemo,
}: {
  slots: Slot[]
  slotCode: string
  packName: string
  packMemo: string
  onChangeSlot: (value: string) => void
  onChangeName: (value: string) => void
  onChangeMemo: (value: string) => void
}) {
  return (
    <div className="space-y-4 pb-4">
      <div className="space-y-2">
        <p className="text-sm font-medium text-gray-700">보관 칸</p>
        <SlotSelector value={slotCode} onChange={onChangeSlot} slots={slots} />
      </div>
      <div className="space-y-2">
        <p className="text-sm font-medium text-gray-700">포장 이름</p>
        <Input value={packName} onChange={(e) => onChangeName(e.target.value)} placeholder="예: 아침 식재료" />
      </div>
      <div className="space-y-2">
        <p className="text-sm font-medium text-gray-700">메모</p>
        <Textarea value={packMemo} onChange={(e) => onChangeMemo(e.target.value)} placeholder="예: 냉장실 앞쪽" rows={3} />
        <small className="text-xs text-muted-foreground">메모는 작성자 본인만 확인할 수 있는 개인 기록입니다.</small>
      </div>
    </div>
  )
}

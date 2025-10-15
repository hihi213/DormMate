"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { TouchEvent } from "react"
import { X, Trash2, ArrowLeft, Pencil } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import { FormFields } from "./form-fields"
import type { Slot } from "../types"
import { useFridge } from "../fridge-context"
import { toYMD } from "@/lib/date-utils"
import type { PendingEntry, TemplateState } from "./types"
import { summarizeEntries, validateTemplate } from "./validation"
import { SlotSelector } from "../slot-selector"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
const NAME_LIMIT = 20
const QTY_LIMIT = 50
const AUTO_PACK_NAME_LIMIT = 12
const formatExpiryDisplay = (expiry: string) => {
  if (!expiry) return "-"
  return expiry.length === 10 ? expiry.slice(2) : expiry
}

const generateAutoPackName = (entries: PendingEntry[]) => {
  if (!entries.length) return ""
  const firstName = entries[0]?.name?.trim() ?? ""
  if (!firstName) return ""
  const truncated =
    firstName.length > AUTO_PACK_NAME_LIMIT ? `${firstName.slice(0, AUTO_PACK_NAME_LIMIT).trimEnd()}...` : firstName
  const extraCount = entries.length - 1
  return extraCount > 0 ? `${truncated} 외 ${extraCount}건` : truncated
}

function createInitialTemplate(slotCode: string): TemplateState {
  return {
    slotCode,
    name: "",
    expiry: toYMD(new Date()),
    qty: 1,
    lockName: false,
  }
}

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
  const { addItem } = useFridge()
  const { toast } = useToast()
  const fallbackSlot = currentSlotCode || slots[0]?.code || ""

  const [template, setTemplate] = useState<TemplateState>(() => createInitialTemplate(fallbackSlot))
  const [entries, setEntries] = useState<PendingEntry[]>([])
  const [packName, setPackName] = useState("")
  const [packMemo, setPackMemo] = useState("")
  const [isMetadataStep, setIsMetadataStep] = useState(false)
  const [metadataSlot, setMetadataSlot] = useState(fallbackSlot)
  const [nameFlash, setNameFlash] = useState(false)
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null)
  const [revealedId, setRevealedId] = useState<string | null>(null)
  const touchRef = useRef<{ id: string | null; startX: number }>({ id: null, startX: 0 })
  const autoPackNameRef = useRef("")

  const nameInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (!open) {
      setTemplate(createInitialTemplate(fallbackSlot))
      setEntries([])
      setPackName("")
      setPackMemo("")
      setIsMetadataStep(false)
      setMetadataSlot(fallbackSlot)
      setNameFlash(false)
      setEditingEntryId(null)
      setRevealedId(null)
      autoPackNameRef.current = ""
    }
  }, [open, fallbackSlot])

  useEffect(() => {
    if (open) {
      setTimeout(() => {
        nameInputRef.current?.focus()
      }, 50)
    }
  }, [open])

  useEffect(() => {
    if (!isMetadataStep) {
      setMetadataSlot(template.slotCode || fallbackSlot)
    }
  }, [isMetadataStep, template.slotCode, fallbackSlot])

  const summary = useMemo(() => summarizeEntries(entries), [entries])
  const autoPackName = useMemo(() => generateAutoPackName(entries), [entries])

  useEffect(() => {
    const shouldApply = packName.trim().length === 0 || packName === autoPackNameRef.current
    autoPackNameRef.current = autoPackName
    if (shouldApply && packName !== autoPackName) {
      setPackName(autoPackName)
    }
  }, [autoPackName, packName])

  const handleTemplateChange = useCallback((updates: Partial<TemplateState>) => {
    setTemplate((prev) => ({ ...prev, ...updates }))
  }, [])

  const isEditing = editingEntryId !== null

  const resetForm = useCallback(
    (options: { keepExpiry?: boolean } = {}) => {
      setTemplate((prev) => {
        const base = createInitialTemplate(prev.slotCode)
        return {
          ...base,
          slotCode: prev.slotCode,
          expiry: options.keepExpiry ? prev.expiry : base.expiry,
        }
      })
      setEditingEntryId(null)
      setTimeout(() => nameInputRef.current?.focus(), 50)
    },
    [nameInputRef],
  )

  const handleSubmitForm = useCallback(() => {
    if (!validateTemplate(template, toast)) return

    const nameNormalized = template.name.trim()

    if (editingEntryId) {
      setEntries((prev) =>
        prev.map((entry) =>
          entry.id === editingEntryId
            ? { ...entry, name: nameNormalized, expiry: template.expiry, qty: template.qty }
            : entry,
        ),
      )
      setNameFlash(true)
      resetForm()
      return
    }

    let applied = false
    setEntries((prev) => {
      const existingIndex = prev.findIndex(
        (entry) => entry.name === nameNormalized && entry.expiry === template.expiry,
      )

      if (existingIndex >= 0) {
        const next = [...prev]
        const combined = next[existingIndex].qty + template.qty
        if (combined > QTY_LIMIT) {
          toast({
            title: "수량 제한",
            description: `같은 항목은 한 번에 최대 ${QTY_LIMIT}개까지 포장할 수 있습니다.`,
          })
          return prev
        }
        next[existingIndex] = { ...next[existingIndex], qty: combined }
        applied = true
        return next
      }

      applied = true
      const newEntry: PendingEntry = {
        id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
        name: nameNormalized,
        expiry: template.expiry,
        qty: template.qty,
      }
      return [...prev, newEntry]
    })

    if (!applied) return

    setNameFlash(true)
    setRevealedId(null)
    resetForm({ keepExpiry: true })
  }, [template, toast, editingEntryId, resetForm])

  const handleRemoveEntry = useCallback((id: string) => {
    setEntries((prev) => prev.filter((entry) => entry.id !== id))
  }, [])
  const handleNameLimit = useCallback(() => {
    toast({
      title: "입력 제한",
      description: `품목명은 최대 ${NAME_LIMIT}자까지 입력할 수 있습니다.`,
    })
  }, [toast])
  const handleQuantityLimit = useCallback(
    (which: "min" | "max") => {
      if (which === "max") {
        toast({
          title: "수량 제한",
          description: `한 번에 최대 ${QTY_LIMIT}개까지 담을 수 있습니다.`,
        })
      }
    },
    [toast],
  )

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
    [],
  )

  const handleRowTouchEnd = useCallback(() => {
    touchRef.current = { id: null, startX: 0 }
  }, [])
  const handleEditEntry = useCallback(
    (entry: PendingEntry) => {
      setTemplate((prev) => ({ ...prev, name: entry.name, expiry: entry.expiry, qty: entry.qty }))
      setEditingEntryId(entry.id)
      setNameFlash(true)
      setRevealedId(null)
      setTimeout(() => nameInputRef.current?.focus(), 50)
    },
    [nameInputRef],
  )

  const handleRequestSave = useCallback(() => {
    if (editingEntryId) {
      toast({ title: "수정 진행 중", description: "수정 완료 버튼을 눌러 변경 사항을 확정해 주세요." })
      return
    }
    if (entries.length === 0) {
      toast({ title: "등록할 항목이 없습니다.", description: "포장에 추가한 품목이 있어야 저장할 수 있습니다." })
      return
    }

    const slotToUse = template.slotCode || fallbackSlot
    if (!slotToUse) {
      toast({ title: "보관 칸을 선택할 수 없습니다.", description: "사용 가능한 보관 칸이 없습니다. 관리자에게 문의해 주세요." })
      return
    }

    setPackName((prev) => (prev.trim().length > 0 ? prev : autoPackName))
    setMetadataSlot(slotToUse)
    setIsMetadataStep(true)
  }, [editingEntryId, entries, toast, template.slotCode, fallbackSlot])

  const handleConfirmSave = useCallback(() => {
    if (entries.length === 0) {
      toast({ title: "등록할 항목이 없습니다.", description: "포장에 추가한 품목이 있어야 저장할 수 있습니다." })
      return
    }

    if (!metadataSlot) {
      toast({ title: "보관 칸을 선택해 주세요.", description: "포장을 저장할 보관 칸을 선택해 주세요." })
      return
    }

    let successCount = 0
    let failureCount = 0
    const packLabel = (packName.trim() || "포장").slice(0, 30)
    const memo = packMemo.trim()

    for (const entry of entries) {
      for (let i = 0; i < entry.qty; i++) {
        const result = addItem({
          slotCode: metadataSlot,
          name: entry.name,
          expiry: entry.expiry,
          memo: memo || undefined,
        })
        if (result.success) successCount += 1
        else failureCount += 1
      }
    }

    if (successCount > 0) {
      toast({
        title: `${packLabel} 저장 완료`,
        description: `총 ${successCount}개의 항목이 냉장고에 등록되었습니다.${failureCount ? ` (${failureCount}개 실패)` : ""}`,
      })
    } else {
      toast({
        title: "등록 실패",
        description: "모든 항목 저장에 실패했습니다. 다시 시도해 주세요.",
      })
    }

    setEntries([])
    setTemplate((prev) => ({ ...createInitialTemplate(metadataSlot), slotCode: metadataSlot }))
    setPackName("")
    setPackMemo("")
    setIsMetadataStep(false)
    onOpenChange(false)
  }, [entries, packName, packMemo, metadataSlot, addItem, onOpenChange, toast])

  const handleBackToItems = useCallback(() => {
    setIsMetadataStep(false)
  }, [])

  const handleCancel = () => {
    onOpenChange(false)
  }

  useEffect(() => {
    if (!nameFlash) return
    const timer = setTimeout(() => setNameFlash(false), 500)
    return () => clearTimeout(timer)
  }, [nameFlash])

  const stepLabel = isMetadataStep ? "2 / 2" : "1 / 2"
  const headerTitle = isMetadataStep ? "포장 정보 입력" : "포장 목록"
  const primaryActionLabel = isMetadataStep ? "보관" : "다음"
  const isPrimaryDisabled = isMetadataStep ? entries.length === 0 || !metadataSlot : entries.length === 0
  const handlePrimaryAction = isMetadataStep ? handleConfirmSave : handleRequestSave

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl h-[80vh] max-h-[90vh] flex flex-col overflow-hidden p-0" showCloseButton={false}>
        <DialogTitle className="sr-only">포장 아이템 추가</DialogTitle>
        <DialogDescription className="sr-only">냉장고 포장 등록 대화상자입니다.</DialogDescription>
        <div className="flex items-center gap-2 bg-white px-4 py-3">
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
            >
              {primaryActionLabel}
            </Button>
          </div>
        </div>
        <div className="border-b bg-white px-4 pb-3">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="secondary" className="bg-emerald-100 text-emerald-800">
              품목 {summary.totalItems}
            </Badge>
            <Badge variant="outline" className="border-emerald-200 text-emerald-700">
              수량 {summary.totalQuantity}
            </Badge>
          </div>
        </div>

        <div className="flex-1 overflow-hidden bg-slate-50">
          <div className="max-h-full overflow-y-auto px-4 py-5 pr-3">
            <PackingCart
              entries={entries}
              onEdit={handleEditEntry}
              onRemove={handleRemoveEntry}
              revealedId={revealedId}
              onRevealChange={setRevealedId}
              onTouchStartRow={handleRowTouchStart}
              onTouchMoveRow={handleRowTouchMove}
              onTouchEndRow={handleRowTouchEnd}
              readOnly={isMetadataStep}
            />
          </div>
        </div>

        <div className="border-t bg-white px-4 pt-3" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)" }}>
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

function PackingCart({
  entries,
  onEdit,
  onRemove,
  revealedId,
  onRevealChange,
  onTouchStartRow,
  onTouchMoveRow,
  onTouchEndRow,
  readOnly = false,
}: {
  entries: PendingEntry[]
  onEdit: (entry: PendingEntry) => void
  onRemove: (id: string) => void
  revealedId: string | null
  onRevealChange: (id: string | null) => void
  onTouchStartRow: (id: string, event: TouchEvent<HTMLDivElement>) => void
  onTouchMoveRow: (id: string, event: TouchEvent<HTMLDivElement>) => void
  onTouchEndRow: () => void
  readOnly?: boolean
}) {
  return (
    <section className="space-y-3 rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
      {entries.length === 0 ? (
        <div className="rounded-xl border border-dashed border-emerald-200 bg-emerald-50 px-4 py-8 text-center text-sm text-muted-foreground">
          아직 담긴 품목이 없습니다. 아래에서 품목을 입력해 포장을 시작해 보세요.
        </div>
      ) : (
        <div className="space-y-3 pr-1">
          {entries.map((entry) => {
            const isRevealed = !readOnly && revealedId === entry.id

            return (
              <div key={entry.id} className="relative overflow-hidden rounded-lg border border-slate-200 shadow-sm">
                {!readOnly && (
                  <div className="absolute inset-y-0 left-0 flex items-center pl-2">
                    <Button
                      variant="destructive"
                      size="icon"
                      aria-label="항목 삭제"
                      onClick={() => {
                        onRemove(entry.id)
                        onRevealChange(null)
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
                  onTouchStart={readOnly ? undefined : (event) => onTouchStartRow(entry.id, event)}
                  onTouchMove={readOnly ? undefined : (event) => onTouchMoveRow(entry.id, event)}
                  onTouchEnd={readOnly ? undefined : onTouchEndRow}
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
                        onRevealChange(null)
                        onEdit(entry)
                      }}
                      className="text-slate-600 hover:bg-slate-100"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
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
        <span className="text-sm font-medium text-gray-700">보관 칸</span>
        <SlotSelector value={slotCode} onChange={onChangeSlot} slots={slots} />
      </div>
      <div className="space-y-2">
        <span className="text-sm font-medium text-gray-700">포장 이름</span>
        <Input value={packName} onChange={(e) => onChangeName(e.target.value)} placeholder="예: 아침 식재료" />
      </div>
      <div className="space-y-2">
        <span className="text-sm font-medium text-gray-700">메모</span>
        <Textarea value={packMemo} onChange={(e) => onChangeMemo(e.target.value)} placeholder="예: 냉장실 앞쪽" rows={3} />
        <p className="text-xs text-muted-foreground">메모는 작성자 본인만 확인할 수 있는 개인 기록입니다.</p>
      </div>
    </div>
  )
}

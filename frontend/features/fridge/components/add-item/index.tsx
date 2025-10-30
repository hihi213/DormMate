"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  X,
  Trash2,
  ArrowLeft,
  Pencil,
  Loader2,
  MoreVertical,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Info,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import { FormFields } from "./form-fields"
import type { Slot } from "@/features/fridge/types"
import { useFridge } from "@/features/fridge/hooks/fridge-context"
import { SlotSelector } from "../slot-selector"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useAddItemWorkflow, formatExpiryDisplay } from "./use-add-item-workflow"
import { getCurrentUserId } from "@/lib/auth"
import { formatCompartmentLabel } from "@/features/fridge/utils/labels"

const LIST_SCROLL_BOX_HEIGHT = "clamp(240px, 35vh, 360px)"

export default function AddItemDialog({
  open = false,
  onOpenChange = () => {},
  slots = [],
  currentSlotId = "",
}: {
  open?: boolean
  onOpenChange?: (v: boolean) => void
  slots?: Slot[]
  currentSlotId?: string
}) {
  const { addBundle, bundles } = useFridge()
  const { toast } = useToast()
  const uid = getCurrentUserId()

  const ownedSlotIds = useMemo(() => {
    if (!uid) return []
    const ids = new Set<string>()
    bundles.forEach((bundle) => {
      if (bundle.slotId && bundle.ownerId && bundle.ownerId === uid) {
        ids.add(bundle.slotId)
      } else if (bundle.slotId && bundle.ownerUserId && bundle.ownerUserId === uid) {
        ids.add(bundle.slotId)
      } else if (!bundle.ownerId && bundle.owner === "me") {
        ids.add(bundle.slotId)
      }
    })
    const activeIds = Array.from(ids).filter((slotId) => {
      const slot = slots.find((s) => s.slotId === slotId)
      return slot ? slot.resourceStatus === "ACTIVE" : true
    })
    activeIds.sort((a, b) => {
      const slotA = slots.find((slot) => slot.slotId === a)
      const slotB = slots.find((slot) => slot.slotId === b)
      const idxA = slotA ? slotA.slotIndex : Number.MAX_SAFE_INTEGER
      const idxB = slotB ? slotB.slotIndex : Number.MAX_SAFE_INTEGER
      return idxA - idxB
    })
    return activeIds
  }, [bundles, uid, slots])

  const fallbackSlot = currentSlotId || ownedSlotIds[0] || slots[0]?.slotId || ""

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
    summary,
    nameInputRef,
    setPackName,
    setPackMemo,
    setMetadataSlot,
    handleTemplateChange,
    handleSubmitForm,
    handleRemoveEntry,
    handleNameLimit,
    handleQuantityLimit,
    handleEditEntry,
    handleCancelEdit,
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
  const listRef = useRef<HTMLDivElement | null>(null)
  const [listCollapsed, setListCollapsed] = useState(false)
  const [showTopShadow, setShowTopShadow] = useState(false)
  const [showBottomShadow, setShowBottomShadow] = useState(false)
  const previousEntryCountRef = useRef(entries.length)

  const updateScrollIndicators = useCallback(() => {
    const el = listRef.current
    if (!el) {
      setShowTopShadow(false)
      setShowBottomShadow(false)
      return
    }
    const { scrollTop, scrollHeight, clientHeight } = el
    setShowTopShadow(scrollTop > 2)
    setShowBottomShadow(scrollTop + clientHeight < scrollHeight - 2)
  }, [])

  const handleListScroll = useCallback(() => {
    updateScrollIndicators()
  }, [updateScrollIndicators])

  useEffect(() => {
    if (!listCollapsed) {
      const timeout = window.setTimeout(() => {
        updateScrollIndicators()
      }, 50)
      return () => window.clearTimeout(timeout)
    }
    setShowTopShadow(false)
    setShowBottomShadow(false)
  }, [entries.length, open, listCollapsed, updateScrollIndicators])

  useEffect(() => {
    const prevCount = previousEntryCountRef.current
    if (!listCollapsed && entries.length > prevCount) {
      listRef.current?.scrollTo({ top: 0, behavior: "smooth" })
    }
    previousEntryCountRef.current = entries.length
  }, [entries.length, listCollapsed])

  const selectedSlot = useMemo(
    () => (metadataSlot ? slots.find((slot) => slot.slotId === metadataSlot) ?? null : null),
    [slots, metadataSlot],
  )
  const currentBundleCount = useMemo(() => {
    if (!metadataSlot) return 0
    return bundles.filter((bundle) => bundle.slotId === metadataSlot).length
  }, [bundles, metadataSlot])
  const slotCapacity = selectedSlot?.capacity ?? null
  const remainingCapacity = slotCapacity != null ? Math.max(slotCapacity - currentBundleCount, 0) : null
  const isSlotFull = slotCapacity != null && remainingCapacity <= 0
  const selectedSlotLabel = selectedSlot
    ? selectedSlot.displayName ?? formatCompartmentLabel(selectedSlot.slotIndex)
    : metadataSlot

  const stepLabel = isMetadataStep ? "2 / 2" : "1 / 2"
  const headerTitle = isMetadataStep ? "포장 정보 입력" : "포장 목록"
  const primaryActionLabel = isMetadataStep ? "보관" : "다음"
  const isPrimaryDisabled = isMetadataStep
    ? isSaving || entries.length === 0 || !metadataSlot || isSlotFull
    : entries.length === 0
  const handlePrimaryAction = isMetadataStep
    ? () => {
        if (isSlotFull) {
          toast({
            title: "보관 칸이 가득 찼습니다.",
            description: `${selectedSlotLabel} 칸은 최대 ${slotCapacity}개 포장을 보관할 수 있습니다.`,
          })
          return
        }
        void handleConfirmSave()
      }
    : handleRequestSave

  const readOnly = isMetadataStep
  const hasEntries = entries.length > 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-2xl flex flex-col gap-0 overflow-hidden p-0 min-h-[520px] max-h-[calc(100svh-24px)]"
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">포장 아이템 추가</DialogTitle>
        <DialogDescription className="sr-only">냉장고 포장 등록 대화상자입니다.</DialogDescription>
        <header className="flex items-center gap-2 bg-white px-3 pb-2 pt-[calc(env(safe-area-inset-top,0px)+10px)]">
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

        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="bg-emerald-100 text-emerald-800">
              품목 {summary.totalItems}
            </Badge>
            <Badge variant="outline" className="border-emerald-200 text-emerald-700">
              수량 {summary.totalQuantity}
            </Badge>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs font-medium text-emerald-700"
            onClick={() => setListCollapsed((prev) => !prev)}
          >
            {listCollapsed ? (
              <>
                <ChevronDown className="mr-1 h-3.5 w-3.5" aria-hidden />
                목록 펼치기
              </>
            ) : (
              <>
                <ChevronUp className="mr-1 h-3.5 w-3.5" aria-hidden />
                목록 접기
              </>
            )}
          </Button>
        </div>

        <div className="flex flex-1 min-h-0 flex-col bg-slate-50 lg:flex-row">
          {listCollapsed ? (
            <div className="px-3 py-4 text-center text-sm text-muted-foreground">
              임시 품목 목록이 접혀 있습니다. 버튼을 눌러 확인하세요.
            </div>
          ) : (
            <section
              ref={listRef}
              className={cn(
                "relative flex-1 min-h-0 overflow-y-auto px-3 py-3",
                "lg:basis-1/2 lg:flex-1",
              )}
              style={{
                height: LIST_SCROLL_BOX_HEIGHT,
                minHeight: LIST_SCROLL_BOX_HEIGHT,
                maxHeight: LIST_SCROLL_BOX_HEIGHT,
              }}
              onScroll={handleListScroll}
            >
              <div
                className={cn(
                  "pointer-events-none absolute left-0 right-0 top-0 h-4 bg-gradient-to-b from-white to-transparent transition-opacity",
                  showTopShadow ? "opacity-100" : "opacity-0",
                )}
              />
              <div
                className={cn(
                  "pointer-events-none absolute bottom-0 left-0 right-0 h-4 bg-gradient-to-t from-white to-transparent transition-opacity",
                  showBottomShadow ? "opacity-100" : "opacity-0",
                )}
              />
              {hasEntries ? (
                entries.map((entry, index) => {
                  return (
                    <article
                      key={entry.id}
                      className={cn(
                        "relative overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm",
                        index > 0 && "mt-2",
                      )}
                    >
                      <div className="flex items-start gap-3 bg-white px-3 py-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-gray-900">{entry.name}</p>
                          <p className="text-xs text-muted-foreground">
                            유통기한 {formatExpiryDisplay(entry.expiryDate)}{" "}
                            <span className="ml-1 text-emerald-600">x{entry.qty}</span>
                          </p>
                        </div>
                        {!readOnly && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label="항목 더보기"
                                className="text-slate-600 hover:bg-slate-100"
                              >
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-36" sideOffset={6}>
                              <DropdownMenuItem
                                className="flex items-center gap-2 text-sm"
                                onSelect={(event) => {
                                  event.preventDefault()
                                  handleEditEntry(entry)
                                }}
                              >
                                <Pencil className="h-4 w-4 text-slate-500" aria-hidden />
                                <span>수정</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="flex items-center gap-2 text-sm text-rose-600 focus:bg-rose-50 focus:text-rose-600"
                                onSelect={(event) => {
                                  event.preventDefault()
                                  handleRemoveEntry(entry.id)
                                }}
                              >
                                <Trash2 className="h-4 w-4" aria-hidden />
                                <span>삭제</span>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
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
          )}

          <div
            className={cn(
              "flex-none max-h-[420px] overflow-y-auto border-t border-slate-200 bg-white px-3 py-3",
              "lg:basis-1/2 lg:flex-1 lg:max-h-none lg:min-h-0 lg:border-t-0 lg:border-l",
            )}
            style={{
              paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)",
              scrollPaddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 72px)",
            }}
          >
            {isMetadataStep ? (
              <MetadataFields
                slots={slots}
                slotId={metadataSlot}
                packName={packName}
                packMemo={packMemo}
                onChangeSlot={setMetadataSlot}
                onChangeName={setPackName}
                onChangeMemo={setPackMemo}
                slotCapacity={slotCapacity}
                currentBundleCount={currentBundleCount}
                remainingCapacity={remainingCapacity}
                slotLabel={selectedSlotLabel}
                isSlotFull={isSlotFull}
              />
            ) : (
              <FormFields
                template={template}
                onTemplateChange={handleTemplateChange}
                onQuantityChange={(qty) => handleTemplateChange({ qty })}
                onExpiryChange={(expiryDate) => handleTemplateChange({ expiryDate })}
                onSubmit={handleSubmitForm}
                nameInputRef={nameInputRef}
                highlightName={nameFlash}
                onCancelEdit={handleCancelEdit}
                onNameLimit={handleNameLimit}
                onQuantityLimit={handleQuantityLimit}
                isEditing={isEditing}
              />
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function MetadataFields({
  slots,
  slotId,
  packName,
  packMemo,
  onChangeSlot,
  onChangeName,
  onChangeMemo,
  slotCapacity,
  currentBundleCount,
  remainingCapacity,
  slotLabel,
  isSlotFull,
}: {
  slots: Slot[]
  slotId: string
  packName: string
  packMemo: string
  onChangeSlot: (value: string) => void
  onChangeName: (value: string) => void
  onChangeMemo: (value: string) => void
  slotCapacity: number | null
  currentBundleCount: number
  remainingCapacity: number | null
  slotLabel: string
  isSlotFull: boolean
}) {
  const capacityKnown = slotCapacity != null
  const remainingText = remainingCapacity != null ? remainingCapacity : 0

  return (
    <div className="space-y-4 pb-4">
      <div className="space-y-2">
        <p className="text-sm font-medium text-gray-700">보관 칸</p>
        <SlotSelector value={slotId} onChange={onChangeSlot} slots={slots} />
        {capacityKnown && (
          <div
            className={cn(
              "mt-2 rounded-md border px-3 py-2",
              isSlotFull
                ? "border-rose-300 bg-rose-50 text-rose-800"
                : "border-emerald-200 bg-emerald-50 text-emerald-800",
            )}
            role="status"
            aria-live="polite"
          >
            <div className="flex items-center gap-2 text-sm font-semibold">
              {isSlotFull ? (
                <AlertTriangle className="h-4 w-4" aria-hidden />
              ) : (
                <Info className="h-4 w-4" aria-hidden />
              )}
              <span>{isSlotFull ? "용량 초과" : "남은 용량"}</span>
            </div>
            <p className="mt-1 text-sm leading-relaxed">
              {slotLabel} 칸은 최대 <strong>{slotCapacity}</strong>개 포장을 보관할 수 있으며 현재{" "}
              <strong>{currentBundleCount}</strong>개가 등록돼 있습니다.
              {isSlotFull
                ? " 다른 칸을 선택해 주세요."
                : ` 추가로 ${remainingText}개 묶음까지 등록할 수 있습니다.`}
            </p>
          </div>
        )}
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

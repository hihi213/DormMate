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
  CheckCircle2,
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
import { getCurrentUser } from "@/lib/auth"
import { formatSlotDisplayName } from "@/features/fridge/utils/labels"

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
  const { addBundle, bundles, refreshSlots } = useFridge()
  const { toast } = useToast()
  const currentUser = getCurrentUser()
  const isAdmin = currentUser?.roles.includes("ADMIN") ?? false
  const restrictSlotViewToOwnership = !isAdmin

  const isSlotSelectable = useCallback(
    (slot: Slot) => slot.resourceStatus === "ACTIVE" && !slot.locked,
    [],
  )

  const describeDisabledSlot = useCallback((slot: Slot) => {
    if (slot.locked) {
      return "검사 중이라 선택할 수 없습니다."
    }
    switch (slot.resourceStatus) {
      case "SUSPENDED":
        return "관리자 점검으로 일시 중지된 칸입니다."
      case "REPORTED":
        return "이상 신고가 접수된 칸입니다."
      case "RETIRED":
        return "퇴역 처리된 칸입니다."
      default:
        return undefined
    }
  }, [])

  const allowedSlots = slots

  const showNoAccessibleSlots = restrictSlotViewToOwnership && allowedSlots.length === 0

  const fallbackSlot =
    (currentSlotId && allowedSlots.some((slot) => slot.slotId === currentSlotId)
      ? currentSlotId
      : allowedSlots.find((slot) => isSlotSelectable(slot))?.slotId) || ""

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
    completion,
    handleFinish,
    handleRegisterAnother,
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
  const handleSlotChange = useCallback(
    (slotId: string) => {
      setMetadataSlot(slotId)
      void refreshSlots()
    },
    [setMetadataSlot, refreshSlots],
  )

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
    () => (metadataSlot ? allowedSlots.find((slot) => slot.slotId === metadataSlot) ?? null : null),
    [allowedSlots, metadataSlot],
  )
  const currentBundleCount = useMemo(() => {
    if (!metadataSlot) return 0
    if (selectedSlot?.occupiedCount != null) {
      return selectedSlot.occupiedCount
    }
    return bundles.filter(
      (bundle) => bundle.slotId === metadataSlot && bundle.status !== "DELETED",
    ).length
  }, [bundles, metadataSlot, selectedSlot])
  const slotCapacity = selectedSlot?.capacity ?? null
  const remainingCapacity = slotCapacity != null ? Math.max(slotCapacity - currentBundleCount, 0) : null
  const isSlotFull = slotCapacity != null && remainingCapacity !== null && remainingCapacity <= 0
  const selectedSlotLabel = selectedSlot
    ? formatSlotDisplayName(selectedSlot)
    : metadataSlot

  const isCompletionStep = completion != null

  const stepLabel = isCompletionStep ? "" : isMetadataStep ? "2 / 2" : "1 / 2"
  const headerTitle = isCompletionStep ? "포장 등록 완료" : isMetadataStep ? "포장 정보 입력" : "포장 목록"
  const primaryActionLabel = isCompletionStep ? "스티커 확인 완료" : isMetadataStep ? "보관" : "다음"
  const isPrimaryDisabled = isCompletionStep
    ? false
    : isMetadataStep
      ? isSaving || entries.length === 0 || !metadataSlot || isSlotFull
      : entries.length === 0
  const handlePrimaryAction = isCompletionStep
    ? handleFinish
    : isMetadataStep
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

  const readOnly = isMetadataStep || isCompletionStep
  const hasEntries = entries.length > 0
  const completionSlot = completion
    ? allowedSlots.find((slot) => slot.slotId === completion.slotId) ?? null
    : null
  const completionSlotLabel = completionSlot ? formatSlotDisplayName(completionSlot) : undefined

  if (showNoAccessibleSlots) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogTitle>{"등록 가능한 칸이 없습니다"}</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {"현재 계정에 배정된 냉장고 칸이 없어 포장을 등록할 수 없습니다. 관리자에게 칸 배정을 요청해 주세요."}
          </DialogDescription>
          <div className="mt-4 flex justify-end">
            <Button type="button" onClick={() => onOpenChange(false)}>
              {"확인"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-2xl flex flex-col gap-0 overflow-hidden p-0 min-h-[520px] max-h-[calc(100svh-24px)]"
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">
          {isCompletionStep ? "포장 등록 완료" : "포장 아이템 추가"}
        </DialogTitle>
        <DialogDescription className="sr-only">
          {isCompletionStep ? "발급된 스티커 정보를 확인하세요." : "냉장고 포장 등록 대화상자입니다."}
        </DialogDescription>
        <header className="flex items-center gap-2 bg-white px-3 pb-2 pt-[calc(env(safe-area-inset-top,0px)+10px)]">
          <Button
            variant="ghost"
            size="icon"
            aria-label={
              isCompletionStep ? "닫기" : isMetadataStep ? "포장 목록으로 돌아가기" : "닫기"
            }
            onClick={isCompletionStep ? handleFinish : isMetadataStep ? handleBackToItems : handleCancel}
          >
            {isCompletionStep || !isMetadataStep ? <X className="h-5 w-5" /> : <ArrowLeft className="h-5 w-5" />}
          </Button>
          <div className="flex-1 text-center text-sm font-semibold text-gray-900">{headerTitle}</div>
          <div className="flex items-center justify-end gap-2">
            {stepLabel && <span className="text-xs font-medium text-emerald-700">{stepLabel}</span>}
            {!isCompletionStep && (
              <Button
                onClick={handlePrimaryAction}
                disabled={isPrimaryDisabled}
                className="inline-flex items-center gap-2 rounded-md bg-gradient-to-r from-emerald-700 to-teal-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:from-emerald-600 hover:to-teal-500 disabled:from-gray-200 disabled:to-gray-200 disabled:text-gray-500"
                data-loading={isSaving && isMetadataStep && !isCompletionStep}
              >
                {isMetadataStep && !isCompletionStep && isSaving && (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                )}
                {primaryActionLabel}
              </Button>
            )}
          </div>
        </header>

        {!isCompletionStep && (
          <>
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
                    entries.map((entry, index) => (
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
                    ))
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
                    slots={allowedSlots}
                    slotId={metadataSlot}
                    packName={packName}
                    packMemo={packMemo}
                    onChangeSlot={handleSlotChange}
                    onChangeName={setPackName}
                    onChangeMemo={setPackMemo}
                    slotCapacity={slotCapacity}
                    currentBundleCount={currentBundleCount}
                    remainingCapacity={remainingCapacity}
                    slotLabel={selectedSlotLabel}
                    isSlotFull={isSlotFull}
                    isSlotSelectable={isSlotSelectable}
                    describeDisabledSlot={describeDisabledSlot}
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

          </>
        )}

        {isCompletionStep && completion && (
          <CompletionView
            bundleLabel={completion.bundleLabel}
            bundleName={completion.bundleName}
            slotLabel={completionSlotLabel}
            totalQuantity={completion.totalQuantity}
            onRegisterAnother={handleRegisterAnother}
          />
        )}
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
  isSlotSelectable,
  describeDisabledSlot,
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
  isSlotSelectable: (slot: Slot) => boolean
  describeDisabledSlot: (slot: Slot) => string | undefined
}) {
  const capacityKnown = slotCapacity != null
  const remainingText = remainingCapacity != null ? remainingCapacity : 0
  const capacityBadge = slotId && isSlotFull ? (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold",
        "border-rose-300 bg-rose-50 text-rose-700",
      )}
      role="status"
      aria-live="polite"
    >
      <AlertTriangle className="h-3 w-3" aria-hidden />
      <span className="tracking-tight">용량 초과</span>
    </span>
  ) : null

  return (
    <div className="space-y-4 pb-4">
      <div className="space-y-1 sm:space-y-0 sm:flex sm:flex-wrap sm:items-center sm:gap-3">
        <p className="text-sm font-medium text-gray-700 sm:w-auto">보관 칸</p>
        <div className="w-full sm:flex-1 sm:min-w-[220px]">
          <SlotSelector
            value={slotId}
            onChange={onChangeSlot}
            slots={slots}
            isSelectable={isSlotSelectable}
            getDisabledDescription={describeDisabledSlot}
            className="w-full"
            statusBadge={capacityBadge}
          />
        </div>
      </div>
      <div className="space-y-2">
        <p className="text-sm font-medium text-gray-700">포장 이름</p>
        <Input value={packName} onChange={(e) => onChangeName(e.target.value)} placeholder="예: 아침 식재료" />
      </div>
      <div className="space-y-2">
        <p className="text-sm font-medium text-gray-700">메모</p>
        <Textarea
          value={packMemo}
          onChange={(e) => onChangeMemo(e.target.value)}
          placeholder="예: 냉장실 앞쪽"
          rows={1}
          className="resize-none min-h-[56px] sm:min-h-[64px]"
        />
        <small className="text-xs text-muted-foreground">메모는 작성자 본인만 확인할 수 있는 개인 기록입니다.</small>
      </div>
    </div>
  )
}

function CompletionView({
  bundleLabel,
  bundleName,
  slotLabel,
  totalQuantity,
  onRegisterAnother,
}: {
  bundleLabel: string
  bundleName?: string | null
  slotLabel?: string
  totalQuantity: number
  onRegisterAnother: () => void
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 bg-white px-6 py-10 text-center">
      <div className="flex flex-col items-center gap-3">
        <CheckCircle2 className="h-12 w-12 text-emerald-600" aria-hidden />
        <h2 className="text-lg font-semibold text-gray-900">물품이 등록되었습니다!</h2>
        <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
          {slotLabel
            ? `${slotLabel} 칸에 등록된 포장의 스티커 번호를 확인하고, 스티커에 적어 붙여주세요.`
            : "발급된 스티커 번호를 확인하고, 스티커에 적어 붙여주세요."}
        </p>
      </div>
      <div className="w-full max-w-xs rounded-xl border border-slate-200 bg-slate-50 px-6 py-5 text-center shadow-sm">
        <p className="text-xs font-medium uppercase tracking-widest text-emerald-700">발급된 스티커 번호</p>
        <p className="mt-2 text-3xl font-bold text-gray-900" aria-live="polite">
          {bundleLabel || "—"}
        </p>
        {bundleName && (
          <p className="mt-1 text-sm font-medium text-slate-700" aria-label="포장 이름">
            {bundleName}
          </p>
        )}
        <p className="mt-3 text-xs text-muted-foreground">총 {totalQuantity}개 품목이 등록되었습니다.</p>
      </div>
      <div className="flex w-full max-w-md flex-col gap-3 sm:flex-row sm:justify-center">
        <Button
          variant="outline"
          onClick={onRegisterAnother}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold"
        >
          또 등록하기
        </Button>
      </div>
    </div>
  )
}

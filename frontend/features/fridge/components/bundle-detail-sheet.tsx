"use client"

import type React from "react"

import { useEffect, useMemo, useState } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Loader2, Trash2, X, Pencil, Check } from "lucide-react"
import { Label } from "@/components/ui/label"
import { useFridge } from "@/features/fridge/hooks/fridge-context"
import { useToast } from "@/hooks/use-toast"
import { getCurrentUser, getCurrentUserId } from "@/lib/auth"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { ExpiryInput } from "@/components/shared/expiry-input"
import { formatStickerLabel } from "@/features/fridge/utils/labels"
import { formatShortDate } from "@/lib/date-utils"

export default function BundleDetailSheet({
  open = false,
  onOpenChange = () => {},
  bundleId = "",
  initialEdit = false,
}: {
  open?: boolean
  onOpenChange?: (v: boolean) => void
  bundleId?: string
  initialEdit?: boolean
}) {
  const {
    items,
    bundles,
    updateItem,
    deleteItem,
    updateBundleMeta,
    deleteBundle: removeBundle,
    isSlotActive,
  } = useFridge()
  const { toast } = useToast()
  const uid = getCurrentUserId()
  const currentUser = getCurrentUser()

  const group = useMemo(() => items.filter((x) => x.bundleId === bundleId), [items, bundleId])
  const first = group[0]
  const bundleMeta = useMemo(
    () => bundles.find((candidate) => candidate.bundleId === bundleId) ?? null,
    [bundles, bundleId],
  )
  const bundleName = first?.bundleName ?? "묶음"
  const groupCode = first ? formatStickerLabel(first.slotIndex, first.labelNumber) : ""
  const representativeMemo = first?.bundleMemo ?? ""
  const slotActive = first ? isSlotActive(first.slotId) : true
  const [slotEditable, setSlotEditable] = useState(slotActive)
  useEffect(() => {
    setSlotEditable(slotActive)
  }, [slotActive])

  const ownerUserId = bundleMeta?.ownerUserId ?? first?.ownerUserId ?? null
  const derivedOwner =
    first?.owner ?? (ownerUserId && uid ? (ownerUserId === uid ? "me" : "other") : "other")
  const isOwner = derivedOwner === "me"
  const canManage = isOwner
  const isAdmin = currentUser?.isAdmin ?? false
  const ownerInfo =
    [bundleMeta?.ownerRoomNumber, bundleMeta?.ownerDisplayName].filter(Boolean).join(" • ") || "소유자 정보 없음"
  const ownerLabel = isOwner ? "내 물품" : isAdmin ? ownerInfo : "타인"
  const memoDescription = isOwner
    ? representativeMemo
      ? `대표 메모: ${representativeMemo}`
      : "대표 메모가 없습니다."
    : isAdmin
      ? `${ownerInfo} 물품입니다. 메모는 비공개예요.`
      : "다른 사람 물품이라 가려졌어요~"
  const canEditBundle = isOwner && slotEditable

  const sorted = useMemo(() => group.slice().sort((a, b) => daysLeft(a.expiryDate) - daysLeft(b.expiryDate)), [group])
  const [bundleNameDraft, setBundleNameDraft] = useState(bundleName)
  const [memoDraft, setMemoDraft] = useState(representativeMemo)
  const [infoEditing, setInfoEditing] = useState(false)
  const [infoSaving, setInfoSaving] = useState(false)
  const [bundleRemoving, setBundleRemoving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [editingUnitId, setEditingUnitId] = useState<string | null>(null)
  const [itemDraft, setItemDraft] = useState<{ name: string; expiryDate: string; quantity: number } | null>(null)

useEffect(() => {
  if (!infoEditing) {
    setBundleNameDraft(bundleName)
  }
}, [bundleName, infoEditing])

useEffect(() => {
  if (!infoEditing) {
    setMemoDraft(representativeMemo)
  }
}, [representativeMemo, infoEditing])

useEffect(() => {
  if (initialEdit && sorted.length > 0) {
    setEditingUnitId(sorted[0].unitId)
    const initialQuantity = sorted[0].quantity ?? 1
    setItemDraft({
      name: splitDetail(sorted[0].name, bundleName)[0],
      expiryDate: sorted[0].expiryDate,
      quantity: initialQuantity > 0 ? initialQuantity : 1,
    })
  } else if (!initialEdit) {
    setEditingUnitId(null)
    setItemDraft(null)
  }
}, [initialEdit, sorted, bundleName])

useEffect(() => {
  if (!open) {
    setInfoEditing(false)
    setInfoSaving(false)
    setEditingUnitId(null)
    setItemDraft(null)
  }
}, [open])

const startInfoEdit = () => {
  if (!slotEditable) {
    toast({
      title: "수정할 수 없습니다",
      description: "해당 칸이 점검 중이거나 일시 중지되었습니다.",
      variant: "destructive",
    })
    return
  }
  setBundleNameDraft(bundleName)
  setMemoDraft(representativeMemo)
  setInfoEditing(true)
}

const cancelInfoEdit = () => {
  setBundleNameDraft(bundleName)
  setMemoDraft(representativeMemo)
  setInfoEditing(false)
}

const handleSaveBundleInfo = async () => {
  if (!bundleId) return
  if (!slotEditable) {
    toast({
      title: "수정할 수 없습니다",
      description: "해당 칸이 점검 중이거나 일시 중지되었습니다.",
      variant: "destructive",
    })
    return
  }
  const trimmedName = bundleNameDraft.trim()
  const trimmedMemo = memoDraft.trim()
  if (!trimmedName) {
    toast({
      title: "대표명을 입력해 주세요.",
      variant: "destructive",
    })
    return
  }

  const nameChanged = trimmedName !== bundleName
  const memoChanged = trimmedMemo !== representativeMemo

  if (memoChanged && sorted.length === 0) {
    toast({
      title: "대표 메모를 저장할 수 없습니다.",
      description: "묶음에 등록된 물품이 없어 대표 메모를 적용할 수 없습니다.",
      variant: "destructive",
    })
    return
  }

  if (!nameChanged && !memoChanged) {
    setInfoEditing(false)
    return
  }

  try {
    setInfoSaving(true)

    const payload: { bundleName?: string; memo?: string | null } = {}
    if (nameChanged) {
      payload.bundleName = trimmedName
    }
    if (memoChanged) {
      payload.memo = trimmedMemo ? trimmedMemo : null
    }

    if (Object.keys(payload).length > 0) {
      const updateResult = await updateBundleMeta(bundleId, payload)
      if (!updateResult.success) {
        if (updateResult.code === "COMPARTMENT_SUSPENDED") {
          setSlotEditable(false)
        }
        throw new Error(updateResult.error ?? "포장 정보를 수정하는 중 문제가 발생했습니다.")
      }
    }

    setBundleNameDraft(trimmedName)
    setMemoDraft(trimmedMemo)
    toast({ title: "포장 정보가 저장되었습니다." })
    setInfoEditing(false)
  } catch (error) {
    toast({
      title: "포장 정보 저장 실패",
      description: error instanceof Error ? error.message : "포장 정보를 저장하는 중 오류가 발생했습니다.",
      variant: "destructive",
    })
  } finally {
    setInfoSaving(false)
  }
}

const handleDeleteBundle = async () => {
  if (!canEditBundle || !bundleId) return
  if (!slotEditable) {
    toast({
      title: "삭제할 수 없습니다",
      description: "해당 칸이 점검 중이거나 일시 중지되었습니다.",
      variant: "destructive",
    })
    return
  }
  if (!confirm("묶음의 모든 물품을 삭제하시겠어요? 이 작업은 되돌릴 수 없습니다.")) return
  try {
    setBundleRemoving(true)
    const result = await removeBundle(bundleId)
    if (result.success) {
      toast({ title: "묶음이 삭제되었습니다." })
      onOpenChange(false)
    } else {
      if (result.code === "COMPARTMENT_SUSPENDED") {
        setSlotEditable(false)
      }
      toast({
        title: "묶음 삭제 실패",
        description: result.error ?? "묶음을 삭제하는 중 오류가 발생했습니다.",
        variant: "destructive",
      })
    }
  } catch (error) {
    toast({
      title: "묶음 삭제 실패",
      description: error instanceof Error ? error.message : "묶음을 삭제하는 중 오류가 발생했습니다.",
      variant: "destructive",
    })
  } finally {
    setBundleRemoving(false)
  }
}

const beginEditItem = (unitId: string, currentName: string, currentExpiryDate: string, currentQuantity: number | null | undefined) => {
  const [detailName] = splitDetail(currentName, bundleName)
  setEditingUnitId(unitId)
  const safeQuantity = currentQuantity && currentQuantity > 0 ? currentQuantity : 1
  setItemDraft({ name: detailName, expiryDate: currentExpiryDate, quantity: safeQuantity })
}

const cancelEditItem = () => {
  setEditingUnitId(null)
  setItemDraft(null)
}

const handleSaveItem = async (unitId: string, useBundlePrefix: boolean) => {
  if (!itemDraft) return
  if (!slotEditable) {
    toast({
      title: "수정할 수 없습니다",
      description: "해당 칸이 점검 중이거나 일시 중지되었습니다.",
      variant: "destructive",
    })
    return
  }
  const nameTrimmed = itemDraft.name.trim()
  if (!nameTrimmed) {
    toast({
      title: "세부명을 입력해 주세요.",
      variant: "destructive",
    })
    return
  }
  const quantity = itemDraft.quantity
  if (!Number.isFinite(quantity) || quantity < 1) {
    toast({
      title: "수량을 확인해 주세요.",
      description: "수량은 1 이상이어야 합니다.",
      variant: "destructive",
    })
    return
  }
  try {
    const newName = useBundlePrefix ? `${bundleName} - ${nameTrimmed}` : nameTrimmed
    const result = await updateItem(unitId, {
      name: newName,
      expiryDate: itemDraft.expiryDate,
      quantity,
    })
    if (result.success) {
      toast({
        title: "수정 완료",
        description: `${nameTrimmed} 항목이 업데이트되었습니다.`,
      })
      setEditingUnitId(null)
      setItemDraft(null)
    } else {
      if (result.code === "COMPARTMENT_SUSPENDED") {
        setSlotEditable(false)
      }
      throw new Error(result.error ?? "물품 수정 중 오류가 발생했습니다.")
    }
  } catch (error) {
    toast({
      title: "수정 실패",
      description: error instanceof Error ? error.message : "물품 수정 중 오류가 발생했습니다.",
      variant: "destructive",
    })
  }
}

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="p-0 max-h-[85svh] overflow-y-auto [&>button.absolute.right-4.top-4]:hidden"
      >
        <SheetHeader className="sr-only">
          <SheetTitle>묶음 상세</SheetTitle>
          <SheetDescription>냉장고 묶음 상세 및 편집 시트</SheetDescription>
        </SheetHeader>
        {/* Header */}
        <div className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b">
          <div className="px-3 py-2 flex items-center justify-between gap-2">
            <Button variant="ghost" size="icon" aria-label="닫기" onClick={() => onOpenChange(false)}>
              <X className="size-5" />
            </Button>
            <div className="text-sm font-semibold truncate">{bundleName || "묶음 상세"}</div>
            <div className="inline-flex items-center gap-1">
              {canEditBundle ? (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="묶음 전체 삭제"
                  onClick={() => void handleDeleteBundle()}
                  disabled={bundleRemoving}
                  title="묶음 전체 삭제"
                >
                  {bundleRemoving ? <Loader2 className="size-5 animate-spin" /> : <Trash2 className="size-5 text-rose-600" />}
                </Button>
              ) : (
                <span className="w-9" aria-hidden="true" />
              )}
            </div>
          </div>
        </div>

        <div className="px-4 pb-6 pt-4 space-y-4">
          {group.length === 0 ? (
            <p className="text-sm text-muted-foreground">{"해당 묶음을 찾을 수 없습니다."}</p>
          ) : (
            <>
              <Card className="border-emerald-200">
                <CardContent className="py-3 space-y-4">
                  {canManage && (
                    <div className="flex justify-end gap-2">
                      {infoEditing ? (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={cancelInfoEdit}
                            disabled={infoSaving}
                          >
                            {"취소"}
                          </Button>
                          <Button
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-700"
                            onClick={() => void handleSaveBundleInfo()}
                            disabled={infoSaving}
                          >
                            {infoSaving && <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />}
                            {"저장"}
                          </Button>
                        </>
                      ) : (
                        <Button variant="ghost" size="sm" onClick={startInfoEdit} disabled={!canEditBundle}>
                          <Pencil className="mr-2 h-4 w-4" />
                          {"정보 수정"}
                        </Button>
                      )}
                    </div>
                  )}

                  {infoEditing ? (
                    <div className="space-y-3">
                      <div>
                        <Label className="text-xs text-muted-foreground">{"대표명"}</Label>
                        <Input
                          value={bundleNameDraft}
                          maxLength={120}
                          onChange={(e) => setBundleNameDraft(e.target.value)}
                          disabled={infoSaving}
                          placeholder="포장 대표명을 입력하세요"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">{"대표 메모 (묶음 전체 공유)"}</Label>
                        <Textarea
                          value={memoDraft}
                          maxLength={200}
                          onChange={(e) => setMemoDraft(e.target.value)}
                          disabled={infoSaving}
                          placeholder="메모를 입력하세요"
                          rows={3}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <Field label="대표명" value={bundleName || "-"} />
                        {groupCode && <Field label="대표 식별번호" value={groupCode} />}
                        <Field label="총 개수" value={`${sorted.length}`} />
                        <Field label="소유자" value={ownerLabel} />
                      </div>
                      <div className="text-xs text-muted-foreground">{memoDescription}</div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardContent className="py-3 space-y-3">
                  {sorted.map((it) => {
                    const d = daysLeft(it.expiryDate)
                    const dText = ddayLabel(d)
                    const statusColor = d < 0 ? "text-rose-600" : d <= 1 ? "text-amber-600" : "text-emerald-700"
                    const [detailName, suffix] = splitDetail(it.name, bundleName)
                    const isEditing = canEditBundle && editingUnitId === it.unitId
                    const draftName = isEditing && itemDraft ? itemDraft.name : detailName
                    const draftExpiry = isEditing && itemDraft ? itemDraft.expiryDate : it.expiryDate
                    const draftQuantity = isEditing && itemDraft ? itemDraft.quantity : it.quantity ?? 1
                    const displayLabel =
                      it.displayLabel ??
                      `${it.bundleLabelDisplay ?? formatStickerLabel(it.slotIndex, it.labelNumber)}-${String(it.seqNo).padStart(2, "0")}`
                    const showItemMemo = isOwner && it.memo && it.memo !== representativeMemo
                    return (
                      <div key={it.unitId} className="rounded-md border p-3 space-y-3">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0 flex-1 space-y-2">
                            {isEditing ? (
                              <>
                                <div>
                                  <Label className="text-xs text-muted-foreground">{"세부명"}</Label>
                                  <Input
                                    value={draftName}
                                    onChange={(e) =>
                                      setItemDraft((prev) =>
                                        prev
                                          ? { ...prev, name: e.target.value }
                                          : {
                                              name: e.target.value,
                                              expiryDate: draftExpiry,
                                              quantity: draftQuantity,
                                            },
                                      )
                                    }
                                  />
                                </div>
                                <div>
                                  <Label className="text-xs text-muted-foreground">{"유통기한"}</Label>
                                  <ExpiryInput
                                    id={`bundle-edit-expiry-${it.unitId}`}
                                    label={undefined}
                                    value={draftExpiry}
                                    onChange={(next) =>
                                      setItemDraft((prev) =>
                                        prev
                                          ? { ...prev, expiryDate: next }
                                          : { name: draftName, expiryDate: next, quantity: draftQuantity },
                                      )
                                    }
                                    presets={[]}
                                    warningThresholdDays={3}
                                    showStatusBadge={false}
                                  />
                                </div>
                                <div>
                                  <Label className="text-xs text-muted-foreground">{"수량"}</Label>
                                  <Input
                                    type="number"
                                    min={1}
                                    value={draftQuantity}
                                    onChange={(e) => {
                                      const nextValue = Number.parseInt(e.target.value, 10)
                                      const safeValue = Number.isNaN(nextValue) ? 1 : nextValue
                                      setItemDraft((prev) =>
                                        prev
                                          ? { ...prev, quantity: safeValue }
                                          : {
                                              name: draftName,
                                              expiryDate: draftExpiry,
                                              quantity: safeValue,
                                            },
                                      )
                                    }}
                                  />
                                </div>
                                {showItemMemo && (
                                  <p className="text-xs text-muted-foreground">{`메모: ${it.memo}`}</p>
                                )}
                              </>
                            ) : (
                              <div className="space-y-1.5">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-base font-semibold truncate">{detailName}</span>
                                  <span className="rounded-full border border-slate-200 px-2 py-0.5 text-[11px] text-slate-600">
                                    {displayLabel}
                                  </span>
                                  {it.quantity != null && (
                                    <span className="rounded-full border border-emerald-200 px-2 py-0.5 text-[11px] text-emerald-700">
                                      {`수량 ${it.quantity}`}
                                    </span>
                                  )}
                                </div>
                                <div className={`text-sm ${statusColor}`}>{`${formatShortDate(it.expiryDate)} • ${dText}`}</div>
                                {showItemMemo && (
                                  <p className="text-xs text-muted-foreground">{`메모: ${it.memo}`}</p>
                                )}
                              </div>
                            )}
                          </div>
                          {canEditBundle && (
                            <div className="shrink-0 flex items-center gap-1 self-start">
                              {isEditing ? (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    aria-label="수정 저장"
                                    onClick={() => void handleSaveItem(it.unitId, suffix)}
                                  >
                                    <Check className="size-4 text-emerald-600" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    aria-label="수정 취소"
                                    onClick={cancelEditItem}
                                  >
                                    <X className="size-4" />
                                  </Button>
                                </>
                              ) : (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  aria-label="수정"
                                  onClick={() => beginEditItem(it.unitId, it.name, it.expiryDate, it.quantity)}
                                  disabled={!slotEditable}
                                >
                                  <Pencil className="size-4" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-rose-600"
                                onClick={async () => {
                                  if (deletingId) return
                                  if (!slotEditable) {
                                    toast({
                                      title: "삭제할 수 없습니다",
                                      description: "해당 칸이 점검 중이거나 일시 중지되었습니다.",
                                      variant: "destructive",
                                    })
                                    return
                                  }
                                  if (!confirm("해당 세부 물품을 삭제할까요? (되돌릴 수 없음)")) return
                                  setDeletingId(it.unitId)
                                  const result = await deleteItem(it.unitId)
                                  setDeletingId(null)
                                  if (result.success) {
                                    toast({
                                      title: "삭제됨",
                                      description: `${detailName} 항목이 삭제되었습니다.`,
                                    })
                                  } else {
                                    if (result.code === "COMPARTMENT_SUSPENDED") {
                                      setSlotEditable(false)
                                    }
                                    toast({
                                      title: "삭제 실패",
                                      description: result.error ?? "세부 물품 삭제 중 오류가 발생했습니다.",
                                      variant: "destructive",
                                    })
                                  }
                                }}
                                disabled={deletingId === it.unitId || !slotEditable}
                                aria-label="삭제"
                              >
                                {deletingId === it.unitId ? (
                                  <Loader2 className="size-4 animate-spin" />
                                ) : (
                                  <Trash2 className="size-4" />
                                )}
                              </Button>
                            </div>
                          )}
                        </div>
                        {isEditing && (
                          <p className="text-xs text-muted-foreground">
                            {"저장을 누르면 해당 물품의 정보가 변경됩니다."}
                          </p>
                        )}
                      </div>
                    )
                  })}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm">{value}</div>
    </div>
  )
}
function splitDetail(fullName: string, bundleName: string): [string, boolean] {
  const prefix = `${bundleName} - `
  if (fullName.startsWith(prefix)) {
    return [fullName.slice(prefix.length), true]
  }
  return [fullName, false]
}
function getBundleName(name: string) {
  const idx = name.indexOf(" - ")
  return idx >= 0 ? name.slice(0, idx) : name
}
function daysLeft(dateISO: string) {
  const today = new Date(new Date().toDateString())
  const d = new Date(dateISO)
  return Math.floor((d.getTime() - today.getTime()) / 86400000)
}
function ddayLabel(n: number) {
  if (isNaN(n)) return ""
  if (n === 0) return "오늘"
  if (n > 0) return `D-${n}`
  return `D+${Math.abs(n)}`
}

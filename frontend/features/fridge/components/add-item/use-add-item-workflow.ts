import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toYMD } from "@/lib/date-utils"
import { summarizeEntries, validateTemplate } from "./validation"
import type { PendingEntry, TemplateState } from "./types"
import type { ActionResult, Bundle, ItemUnit } from "@/features/fridge/types"
import { AUTO_PACK_NAME_LIMIT, NAME_LIMIT, PACK_LABEL_LIMIT, QTY_LIMIT } from "./constants"
import { formatStickerLabel } from "@/features/fridge/utils/labels"

export const formatExpiryDisplay = (expiry: string) => {
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

const createInitialTemplate = (slotId: string): TemplateState => ({
  slotId,
  name: "",
  expiryDate: toYMD(new Date()),
  qty: 1,
  lockName: false,
})

type ToastFn = (opts: { title: string; description?: string; variant?: "default" | "destructive" | null }) => void

type AddBundleFn = (data: {
  slotId: string
  bundleName: string
  memo?: string | null
  units: { name: string; expiryDate: string; quantity: number; unitCode?: string | null }[]
}) => Promise<
  ActionResult<{ bundleId: string; unitIds: string[]; bundle: Bundle; units: ItemUnit[] }>
>

type CompletionState = {
  bundleLabel: string
  bundleName: string
  slotId: string
  totalQuantity: number
}

export const useAddItemWorkflow = ({
  fallbackSlot,
  toast,
  addBundle,
  open,
  onClose,
}: {
  fallbackSlot: string
  toast: ToastFn
  addBundle: AddBundleFn
  open: boolean
  onClose: () => void
}) => {
  const [template, setTemplate] = useState<TemplateState>(() => createInitialTemplate(fallbackSlot))
  const [entries, setEntries] = useState<PendingEntry[]>([])
  const [packName, setPackName] = useState("")
  const [packMemo, setPackMemo] = useState("")
  const [isMetadataStep, setIsMetadataStep] = useState(false)
  const [metadataSlot, setMetadataSlot] = useState(fallbackSlot)
  const [nameFlash, setNameFlash] = useState(false)
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [completion, setCompletion] = useState<CompletionState | null>(null)

  const autoPackNameRef = useRef("")
  const nameInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (!fallbackSlot) return
    setTemplate((prev) => {
      if (prev.slotId) return prev
      return { ...prev, slotId: fallbackSlot }
    })
  }, [fallbackSlot])

  const summary = useMemo(() => summarizeEntries(entries), [entries])
  const autoPackName = useMemo(() => generateAutoPackName(entries), [entries])

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
      autoPackNameRef.current = ""
      setCompletion(null)
      return
    }

    const timer = setTimeout(() => nameInputRef.current?.focus(), 50)
    return () => clearTimeout(timer)
  }, [open, fallbackSlot])

  useEffect(() => {
    const shouldApply = packName.trim().length === 0 || packName === autoPackNameRef.current
    autoPackNameRef.current = autoPackName
    if (shouldApply && packName !== autoPackName) {
      setPackName(autoPackName)
    }
  }, [autoPackName, packName])

  useEffect(() => {
    if (!isMetadataStep) {
      setMetadataSlot(template.slotId || fallbackSlot)
    }
  }, [isMetadataStep, template.slotId, fallbackSlot])

  useEffect(() => {
    if (!nameFlash) return
    const timer = setTimeout(() => setNameFlash(false), 500)
    return () => clearTimeout(timer)
  }, [nameFlash])

  const handleTemplateChange = useCallback((updates: Partial<TemplateState>) => {
    setTemplate((prev) => ({ ...prev, ...updates }))
  }, [])

  const resetForm = useCallback(
    (options: { keepExpiry?: boolean } = {}) => {
      setTemplate((prev) => {
        const base = createInitialTemplate(prev.slotId)
        return {
          ...base,
          slotId: prev.slotId,
          expiryDate: options.keepExpiry ? prev.expiryDate : base.expiryDate,
        }
      })
      setEditingEntryId(null)
      setTimeout(() => nameInputRef.current?.focus(), 50)
    },
    [],
  )

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

  const handleSubmitForm = useCallback(() => {
    if (!validateTemplate(template, toast)) return

    const nameNormalized = template.name.trim()

    if (editingEntryId) {
      setEntries((prev) =>
        prev.map((entry) =>
          entry.id === editingEntryId
            ? { ...entry, name: nameNormalized, expiryDate: template.expiryDate, qty: template.qty }
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
        (entry) => entry.name === nameNormalized && entry.expiryDate === template.expiryDate,
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
        expiryDate: template.expiryDate,
        qty: template.qty,
      }
      return [newEntry, ...prev]
    })

    if (!applied) return

    setNameFlash(true)
    resetForm()
  }, [template, toast, editingEntryId, resetForm])

  const handleRemoveEntry = useCallback(
    (id: string) => {
      setEntries((prev) => prev.filter((entry) => entry.id !== id))
      if (editingEntryId === id) {
        resetForm({ keepExpiry: true })
      }
    },
    [editingEntryId, resetForm],
  )

  const handleEditEntry = useCallback(
    (entry: PendingEntry) => {
      setTemplate((prev) => ({ ...prev, name: entry.name, expiryDate: entry.expiryDate, qty: entry.qty }))
      setEditingEntryId(entry.id)
      setNameFlash(true)
      setTimeout(() => nameInputRef.current?.focus(), 50)
    },
    [],
  )

  const handleCancelEdit = useCallback(() => {
    resetForm({ keepExpiry: true })
  }, [resetForm])

  const handleRequestSave = useCallback(() => {
    if (editingEntryId) {
      toast({ title: "수정 진행 중", description: "수정 완료 버튼을 눌러 변경 사항을 확정해 주세요." })
      return
    }
    if (entries.length === 0) {
      toast({ title: "등록할 항목이 없습니다.", description: "포장에 추가한 품목이 있어야 저장할 수 있습니다." })
      return
    }

    const slotToUse = template.slotId || fallbackSlot
    if (!slotToUse) {
      toast({ title: "보관 칸을 선택할 수 없습니다.", description: "사용 가능한 보관 칸이 없습니다. 관리자에게 문의해 주세요." })
      return
    }

    setPackName((prev) => (prev.trim().length > 0 ? prev : autoPackName))
    setMetadataSlot(slotToUse)
    setIsMetadataStep(true)
  }, [editingEntryId, entries, toast, template.slotId, fallbackSlot, autoPackName])

  const handleConfirmSave = useCallback(async () => {
    if (entries.length === 0) {
      toast({ title: "등록할 항목이 없습니다.", description: "포장에 추가한 품목이 있어야 저장할 수 있습니다." })
      return
    }

    if (!metadataSlot) {
      toast({ title: "보관 칸을 선택해 주세요.", description: "포장을 저장할 보관 칸을 선택해 주세요." })
      return
    }

    const packLabel = (packName.trim() || "포장").slice(0, PACK_LABEL_LIMIT)
    const memo = packMemo.trim()

    const payloadUnits = entries.flatMap((entry) =>
      Array.from({ length: entry.qty }).map(() => ({
        name: entry.name,
        expiryDate: entry.expiryDate,
        quantity: 1,
      })),
    )

    try {
      setIsSaving(true)

      const result = await addBundle({
        slotId: metadataSlot,
        bundleName: packLabel,
        memo: memo || undefined,
        units: payloadUnits,
      })

      if (!result.success) {
        toast({
          title: "등록 실패",
          description: result.error ?? "포장 저장에 실패했습니다. 잠시 후 다시 시도해 주세요.",
          variant: "destructive",
        })
        return
      }

      toast({
        title: `${packLabel} 저장 완료`,
        description: `총 ${summary.totalQuantity}개 품목이 등록되었습니다.`,
      })

      const bundle = result.data?.bundle
      const bundleLabel = bundle
        ? bundle.labelDisplay || formatStickerLabel(bundle.slotIndex, bundle.labelNumber)
        : ""

      setEntries([])
      setTemplate((prev) => ({ ...createInitialTemplate(metadataSlot), slotId: metadataSlot }))
      setPackName("")
      setPackMemo("")
      setIsMetadataStep(false)
      setCompletion({
        bundleLabel,
        bundleName: bundle?.bundleName ?? packLabel,
        slotId: metadataSlot,
        totalQuantity: summary.totalQuantity,
      })
    } catch (error) {
      toast({
        title: "등록 실패",
        description: error instanceof Error ? error.message : "포장 저장 중 오류가 발생했습니다.",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }, [
    entries,
    packName,
    packMemo,
    metadataSlot,
    addBundle,
    toast,
    summary.totalQuantity,
  ])

  const handleBackToItems = useCallback(() => {
    setIsMetadataStep(false)
  }, [])

  const handleCancel = useCallback(() => {
    setCompletion(null)
    onClose()
  }, [onClose])

  const handleFinish = useCallback(() => {
    setCompletion(null)
    onClose()
  }, [onClose])

  const handleRegisterAnother = useCallback(() => {
    setCompletion(null)
    const nextSlot = metadataSlot || fallbackSlot
    setTemplate(createInitialTemplate(nextSlot))
    setEntries([])
    setPackName("")
    setPackMemo("")
    setIsMetadataStep(false)
    setMetadataSlot(nextSlot)
    setEditingEntryId(null)
    setNameFlash(false)
    autoPackNameRef.current = ""
    setTimeout(() => nameInputRef.current?.focus(), 50)
  }, [metadataSlot, fallbackSlot])

  return {
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
  }
}

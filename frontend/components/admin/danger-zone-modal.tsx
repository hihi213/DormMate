"use client"

import * as React from "react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"

export type DangerZoneModalProps = {
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => Promise<void> | void
  triggerLabel?: string
  trigger?: React.ReactNode
  destructive?: boolean
  children?: React.ReactNode
  confirmDisabled?: boolean
}

/**
 * 관리자 위험 작업(Danger Zone) 확인용 모달 스켈레톤.
 * 트리거와 확인 버튼을 공통 패턴으로 제공해 실수로 인한 파괴적 변경을 최소화한다.
 */
export function DangerZoneModal({
  title,
  description,
  confirmLabel = "확인",
  cancelLabel = "취소",
  onConfirm,
  triggerLabel = "Danger Action",
  trigger,
  destructive = true,
  children,
  confirmDisabled = false,
}: DangerZoneModalProps) {
  const [isPending, startTransition] = React.useTransition()

  const handleConfirm = React.useCallback(() => {
    startTransition(async () => {
      await onConfirm()
    })
  }, [onConfirm])

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        {trigger ?? (
          <Button variant={destructive ? "destructive" : "default"}>
            {triggerLabel}
          </Button>
        )}
      </AlertDialogTrigger>
      <AlertDialogContent data-component="admin-danger-zone-modal">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {children ? <div className="space-y-3 py-2">{children}</div> : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive hover:bg-destructive/90"
            disabled={isPending || confirmDisabled}
            onClick={handleConfirm}
          >
            {isPending ? "처리 중…" : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

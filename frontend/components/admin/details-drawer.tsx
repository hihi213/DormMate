"use client"

import * as React from "react"

import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type DrawerWidth = "sm" | "md" | "lg"

export type DetailsDrawerProps = {
  title: string
  description?: string
  open: boolean
  onOpenChange?: (open: boolean) => void
  children: React.ReactNode
  footer?: React.ReactNode
  width?: DrawerWidth
  className?: string
}

const widthMap: Record<DrawerWidth, string> = {
  sm: "sm:max-w-sm",
  md: "sm:max-w-lg",
  lg: "sm:max-w-3xl",
}

/**
 * 관리자 상세 패널 스켈레톤.
 * 공통 Drawer 레이아웃을 사용해 상세 정보 · 수정 폼 · 히스토리 등을 일관된 패턴으로 제공한다.
 */
export function DetailsDrawer({
  title,
  description,
  open,
  onOpenChange,
  children,
  footer,
  width = "lg",
  className,
}: DetailsDrawerProps) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent
        className={cn(
          "sm:right-0 sm:left-auto sm:w-full",
          widthMap[width],
          className
        )}
        data-component="admin-details-drawer"
        data-width={width}
      >
        <DrawerHeader>
          <DrawerTitle>{title}</DrawerTitle>
          {description ? (
            <DrawerDescription>{description}</DrawerDescription>
          ) : null}
        </DrawerHeader>
        <section className="flex-1 overflow-y-auto px-4 pb-4">{children}</section>
        <DrawerFooter>
          {footer ?? (
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => onOpenChange?.(false)}>
                닫기
              </Button>
            </div>
          )}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}

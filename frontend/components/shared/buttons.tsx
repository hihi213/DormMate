"use client"
import { forwardRef } from "react"
import { Button, type ButtonProps } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export const PrimaryButton = forwardRef<HTMLButtonElement, ButtonProps>(function PrimaryButton(
  { className, ...props },
  ref,
) {
  return <Button ref={ref} className={cn("bg-emerald-600 hover:bg-emerald-700", className)} {...props} />
})

export const DestructiveButton = forwardRef<HTMLButtonElement, ButtonProps>(function DestructiveButton(
  { className, ...props },
  ref,
) {
  return <Button ref={ref} variant="destructive" className={cn("", className)} {...props} />
})

"use client"

import type React from "react"
import { forwardRef, useId } from "react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

type FloatingInputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label: string
  rightAdornment?: React.ReactNode
  containerClassName?: string
}

const FloatingInput = forwardRef<HTMLInputElement, FloatingInputProps>(function FloatingInput(
  { id, label, value, rightAdornment, className, containerClassName, placeholder, ...props },
  ref,
) {
  const autoId = useId()
  const fieldId = id || autoId
  const hasValue = typeof value === "string" ? value.trim().length > 0 : value != null

  return (
    <div className={cn("relative", containerClassName)} data-has-value={hasValue ? "true" : "false"}>
      <Input
        id={fieldId}
        ref={ref}
        value={value as any}
        placeholder={placeholder ?? " "}
        className={cn("peer h-11 pr-16", className)}
        {...props}
      />
      <label
        htmlFor={fieldId}
        className={cn(
          "pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 bg-white px-1 text-[13px] text-muted-foreground transition-all duration-200",
          // 기본 상태: 중앙에 위치
          "peer-focus:-top-2 peer-focus:text-[11px] peer-focus:text-emerald-700",
          // 값이 있을 때: 위에 작게 표시
          hasValue && "-top-2 text-[11px] text-gray-700",
        )}
      >
        {label}
      </label>
      {rightAdornment && <div className="absolute right-2 top-1/2 -translate-y-1/2">{rightAdornment}</div>}
    </div>
  )
})

export default FloatingInput

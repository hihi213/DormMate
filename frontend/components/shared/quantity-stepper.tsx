"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Minus, Plus } from "lucide-react"
import { cn } from "@/lib/utils"

export default function QuantityStepper({
  value = 1,
  min = 1,
  max = 99,
  onChange = () => {},
  onLimitReach,
  className,
  inputClassName,
  ariaLabel = "수량",
}: {
  value?: number
  min?: number
  max?: number
  onChange?: (n: number) => void
  onLimitReach?: (which: "min" | "max") => void
  className?: string
  inputClassName?: string
  ariaLabel?: string
}) {
  const dec = () => {
    const next = Math.max(min, (value || 0) - 1)
    if (next === value && onLimitReach) onLimitReach("min")
    onChange(next)
  }
  const inc = () => {
    const next = Math.min(max, (value || 0) + 1)
    if (next === value && onLimitReach) onLimitReach("max")
    onChange(next)
  }
  const onInput = (n: number) => {
    if (Number.isNaN(n)) return
    const clamped = Math.min(max, Math.max(min, n))
    onChange(clamped)
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Button size="icon" variant="outline" onClick={dec} aria-label="감소" disabled={value <= min} className="flex-shrink-0">
        <Minus className="w-4 h-4" />
      </Button>
      <Input
        className={cn("w-16 text-center h-10 flex-shrink-0", inputClassName)}
        type="number"
        min={min}
        max={max}
        value={value}
        aria-label={ariaLabel}
        onChange={(e) => onInput(Number(e.target.value))}
      />
      <Button size="icon" variant="outline" onClick={inc} aria-label="증가" disabled={value >= max} className="flex-shrink-0">
        <Plus className="w-4 h-4" />
      </Button>
    </div>
  )
}

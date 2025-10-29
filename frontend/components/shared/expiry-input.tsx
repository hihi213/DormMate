"use client"

import { useMemo } from "react"
import { CalendarDays } from "lucide-react"
import { cn } from "@/lib/utils"
import { addDays, clampToToday, ddayInlineLabel, daysDiffFromToday, parseYMD, toYMD } from "@/lib/date-utils"

type Preset = {
  label: string
  offsetDays: number
  ariaLabel?: string
}

interface ExpiryInputProps {
  id?: string
  label?: string
  value: string
  onChange: (next: string) => void
  minDate?: string
  helperText?: string
  className?: string
  warningThresholdDays?: number
  presets?: Preset[]
  disabled?: boolean
  required?: boolean
  emphasizeToday?: boolean
  inputClassName?: string
  showStatusBadge?: boolean
}

export function ExpiryInput({
  id = "expiry",
  label = "유통기한",
  value,
  onChange,
  minDate,
  helperText,
  className,
  warningThresholdDays = 3,
  presets,
  disabled = false,
  required = false,
  emphasizeToday = false,
  inputClassName,
  showStatusBadge = true,
}: ExpiryInputProps) {
  const safeMin = minDate ?? toYMD(new Date())
  const presetButtons = presets ?? defaultPresets
  const [firstPreset, ...restPresets] = presetButtons

  const status = useMemo(() => {
    if (!value) {
      return { text: "", color: "text-muted-foreground" }
    }
    const diff = daysDiffFromToday(value)
    if (Number.isNaN(diff)) {
      return { text: "", color: "text-muted-foreground" }
    }
    let color = "text-emerald-700"
    if (diff < 0) color = "text-rose-600"
    else if (diff <= warningThresholdDays) color = "text-amber-600"

    return {
      text: ddayInlineLabel(diff),
      color,
    }
  }, [value, warningThresholdDays])

  const resolveBaseDate = (preset: Preset) => {
    if (preset.offsetDays === 0) return new Date()
    if (!value) return new Date()
    const parsed = parseYMD(value)
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed
  }

  const applyPreset = (preset: Preset) => {
    const baseDate = resolveBaseDate(preset)
    const targetDate = preset.offsetDays === 0 ? baseDate : addDays(baseDate, preset.offsetDays)
    onChange(clampToToday(toYMD(targetDate)))
  }

  return (
    <div className={cn("grid gap-2", className)}>
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="flex items-center gap-1 text-sm font-medium text-gray-700">
          {label}
          {required && <span className="text-rose-500">*</span>}
        </label>
        {showStatusBadge && status.text && (
          <span className={cn("inline-flex items-center gap-1 text-xs font-medium whitespace-nowrap", status.color)}>
            <CalendarDays className="h-4 w-4" />
            {status.text}
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {emphasizeToday && firstPreset && (
          <button
            type="button"
            className="inline-flex h-9 items-center rounded-full border border-emerald-200 bg-emerald-100 px-3 text-xs font-medium text-emerald-800 shadow-sm transition hover:bg-emerald-200 disabled:opacity-60"
            onClick={() => applyPreset(firstPreset)}
            disabled={disabled}
            aria-label={firstPreset.ariaLabel ?? `${firstPreset.label}로 설정`}
          >
            {firstPreset.label}
          </button>
        )}
        <input
          id={id}
          type="date"
          value={value}
          min={safeMin}
          disabled={disabled}
          onChange={(event) => onChange(clampToToday(event.target.value))}
          className={cn(
            "flex-1 min-w-0 h-10 rounded-md border px-3 py-2 text-sm",
            disabled && "bg-muted text-muted-foreground",
            inputClassName
          )}
        />

        {(emphasizeToday ? restPresets : presetButtons).map((preset) => (
          <button
            key={preset.label}
            type="button"
            className="inline-flex h-9 items-center rounded-full border border-emerald-100 bg-emerald-50 px-3 text-xs font-medium text-emerald-700 shadow-sm transition hover:bg-emerald-100 disabled:opacity-60"
            onClick={() => applyPreset(preset)}
            disabled={disabled}
            aria-label={preset.ariaLabel ?? `${preset.label}로 설정`}
          >
            {preset.label}
          </button>
        ))}
      </div>

      {helperText && <p className="text-xs text-muted-foreground">{helperText}</p>}
    </div>
  )
}

const defaultPresets: Preset[] = [
  { label: "오늘", offsetDays: 0, ariaLabel: "오늘로 설정" },
  { label: "+1", offsetDays: 1, ariaLabel: "내일로 설정" },
  { label: "+7", offsetDays: 7, ariaLabel: "7일 뒤로 설정" },
]

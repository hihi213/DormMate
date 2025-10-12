"use client"

import { Input } from "@/components/ui/input"
import type React from "react"

export default function SearchBar({
  value = "",
  onChange = () => {},
  placeholder = "",
  rightIcon,
}: {
  value?: string
  onChange?: (v: string) => void
  placeholder?: string
  rightIcon?: React.ReactNode
}) {
  return (
    <div className="relative">
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        inputMode="search"
        className="pr-9"
        aria-label="검색"
      />
      {rightIcon && <div className="absolute right-2 top-1/2 -translate-y-1/2">{rightIcon}</div>}
    </div>
  )
}

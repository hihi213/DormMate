"use client"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export type ItemStatus = "expired" | "expiring" | "ok"

export default function StatusBadge({
  status,
  showIfOk = false,
  className,
  labels = { expired: "만료", expiring: "임박", ok: "정상" },
}: {
  status: ItemStatus
  showIfOk?: boolean
  className?: string
  labels?: { expired: string; expiring: string; ok: string }
}) {
  if (status === "ok" && !showIfOk) return null
  const base =
    status === "expired"
      ? "bg-rose-600 hover:bg-rose-700"
      : status === "expiring"
        ? "bg-amber-500 hover:bg-amber-600"
        : "bg-emerald-600 hover:bg-emerald-700"
  return <Badge className={cn(base, className)}>{labels[status]}</Badge>
}

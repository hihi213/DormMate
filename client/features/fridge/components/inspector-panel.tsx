"use client"

import type React from "react"

import type { Item } from "@/features/fridge/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useMemo, useState } from "react"
import { AlertTriangle, Bell, Check } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { formatShortDate } from "@/lib/date-utils"

export default function InspectorPanel({
  lastInspectionAt = 0,
  onSetInspectionNow = () => {},
  items = [],
  slotCode = "",
}: {
  lastInspectionAt?: number
  onSetInspectionNow?: () => void
  items?: Item[]
  slotCode?: string
}) {
  const { toast } = useToast()
  const [selectedIds, setSelected] = useState<string[]>([])

  const now = new Date()
  const expired = useMemo(
    () => items.filter((i) => daysLeft(i.expiry) < 0 && (slotCode ? i.slotCode === slotCode : true)),
    [items, slotCode],
  )
  const changedAfter = useMemo(
    () => items.filter((i) => i.updatedAt > lastInspectionAt && (slotCode ? i.slotCode === slotCode : true)),
    [items, lastInspectionAt, slotCode],
  )

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))

  return (
    <Card className="mt-4 border-emerald-200">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <AlertTriangle className="size-4 text-emerald-700" />
          {"검사 대상"}
          <Badge variant="secondary" className="ml-auto">{`만료 ${expired.length}`}</Badge>
          <Badge variant="secondary">{`변경 ${changedAfter.length}`}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Expired */}
        <Section title="만료 물품" count={expired.length}>
          {expired.slice(0, 5).map((i) => (
            <Row
              key={i.id}
              id={i.id}
              name={i.name}
              label={i.label}
              onToggle={toggle}
              selected={selectedIds.includes(i.id)}
            />
          ))}
          {expired.length > 5 && <More text={`외 ${expired.length - 5}건 더 보기`} />}
        </Section>

        {/* Changed after inspection */}
        <Section title="검사일 이후 추가/수정" count={changedAfter.length}>
          {changedAfter.slice(0, 5).map((i) => (
            <Row
              key={i.id}
              id={i.id}
              name={i.name}
              label={i.label}
              onToggle={toggle}
              selected={selectedIds.includes(i.id)}
            />
          ))}
          {changedAfter.length > 5 && <More text={`외 ${changedAfter.length - 5}건 더 보기`} />}
        </Section>

        <div className="flex items-center gap-2 pt-2">
          <Button
            className="bg-emerald-600 hover:bg-emerald-700"
            onClick={() => {
              toast({ title: "검사 알림 전송", description: `${selectedIds.length}건 관련자에게 알림 발송` })
              setSelected([])
            }}
          >
            <Bell className="size-4 mr-1" />
            {"검사 종료 및 알림"}
          </Button>
          <Button variant="outline" onClick={onSetInspectionNow}>
            <Check className="size-4 mr-1" />
            {"검사 기준일 갱신"}
          </Button>
          <span className="text-xs text-muted-foreground ml-auto">
            {lastInspectionAt ? `기준일 ${formatShortDate(new Date(lastInspectionAt))}` : "기준일 미설정"}
          </span>
        </div>
      </CardContent>
    </Card>
  )
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-medium text-gray-700 mb-2">
        {title} <span className="text-muted-foreground">({count})</span>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  )
}

function Row({
  id,
  name,
  label,
  selected,
  onToggle = () => {},
}: {
  id: string
  name: string
  label: string
  selected?: boolean
  onToggle?: (id: string) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onToggle(id)}
      className={`w-full flex items-center justify-between rounded-md border p-2 text-left ${selected ? "bg-emerald-50 border-emerald-200" : "hover:bg-gray-50"}`}
      aria-pressed={selected}
    >
      <div className="text-sm">
        <div className="font-medium">{name}</div>
        <div className="text-xs text-muted-foreground">
          {label} • {id}
        </div>
      </div>
      <input type="checkbox" readOnly checked={!!selected} className="size-4" aria-label={`${name} 선택`} />
    </button>
  )
}

function More({ text }: { text: string }) {
  return <div className="text-xs text-muted-foreground">{text}</div>
}

function daysLeft(dateISO: string) {
  const today = new Date(new Date().toDateString())
  const d = new Date(dateISO)
  return Math.floor((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

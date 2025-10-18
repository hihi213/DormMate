"use client"

import type React from "react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Scan, Plus, Shirt, DoorOpen, BookOpen, Timer } from "lucide-react"

type QuickAction = {
  label: string
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
  hint?: string
  onClick?: () => void
}

const defaultActions: QuickAction[] = [
  { label: "냉장고 물품 등록", icon: Plus },
  { label: "NFC 스캔", icon: Scan },
  { label: "세탁 사용 시작", icon: Shirt },
  { label: "스터디룸 예약", icon: DoorOpen },
  { label: "도서 검색", icon: BookOpen },
  { label: "내 타이머", icon: Timer },
]

export default function QuickActions(
  { actions = defaultActions }: { actions?: QuickAction[] } = { actions: defaultActions },
) {
  return (
    <div className="mt-3 grid grid-cols-3 gap-3">
      {actions.map((a, idx) => (
        <Card key={idx} className="p-3 hover:shadow-sm transition select-none">
          <Button
            variant="ghost"
            className="w-full h-auto p-0 flex flex-col items-center gap-2 text-center"
            onClick={a.onClick}
            aria-label={a.label}
          >
            <div className="size-10 rounded-lg bg-emerald-600 text-white grid place-items-center" aria-hidden="true">
              <a.icon className="size-5" />
            </div>
            <span className="text-xs font-medium leading-tight">{a.label}</span>
          </Button>
        </Card>
      ))}
    </div>
  )
}

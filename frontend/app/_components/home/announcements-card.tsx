"use client"

import { CalendarDays, Megaphone } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"

import type { NextInspection } from "./use-home-state"

type Props = {
  nextInspection: NextInspection
}

export default function AnnouncementsCard({ nextInspection }: Props) {
  return (
    <Card className="border-slate-200 bg-slate-50">
      <CardContent className="py-3">
        <div className="flex items-start gap-2">
          <div className="w-7 h-7 rounded-md bg-emerald-600 text-white grid place-items-center" aria-hidden="true">
            <Megaphone className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold truncate">{"주요 공지"}</p>
            <p className="text-[11px] text-slate-700 truncate">{"하계 휴관 안내 (8/1~8/20) • 정기 소독 안내"}</p>
          </div>
        </div>

        <div className="mt-2 pt-2 border-t">
          <div className="flex items-start gap-2">
            <div className="w-7 h-7 rounded-md bg-slate-700 text-white grid place-items-center" aria-hidden="true">
              <CalendarDays className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold truncate">{"다음 냉장고 정기점검"}</p>
              <p className="text-[11px] text-slate-700 truncate">
                {nextInspection ? `${nextInspection.label}` : "불러오는 중..."}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

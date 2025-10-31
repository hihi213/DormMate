"use client"

import type React from "react"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Settings, Users, DoorOpen, BookOpen, Snowflake, Shirt, FileDown, Shield } from "lucide-react"

export default function AdminPanelTeaser() {
  const [open, setOpen] = useState(false)

  return (
    <Card className="border-dashed">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Settings className="size-4 text-emerald-700" />
          {"관리자 도구"}
          <Button
            size="sm"
            variant="ghost"
            className="ml-auto text-emerald-700"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="admin-tools-list"
          >
            {open ? "접기" : "펼치기"}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent id="admin-tools-list" className="pt-0">
        <p className="text-xs text-muted-foreground">{"로그인 후 권한에 따라 접근 가능합니다."}</p>
        {open && (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <AdminAction icon={Users} label="사용자 관리" />
            <AdminAction icon={Shield} label="권한 관리" />
            <AdminAction icon={Snowflake} label="냉장고 자원" />
            <AdminAction icon={Shirt} label="세탁소 자원" />
            <AdminAction icon={BookOpen} label="도서 관리" />
            <AdminAction icon={DoorOpen} label="스터디룸 관리" />
            <AdminAction icon={FileDown} label="로그 내보내기" />
            <AdminAction icon={Settings} label="휴관 설정" />
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function AdminAction({
  icon: Icon,
  label,
}: {
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
  label: string
}) {
  return (
    <button
      type="button"
      className="w-full rounded-md border p-3 text-left hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
      aria-label={label}
    >
      <div className="flex items-center gap-2">
        <div className="size-8 rounded-md bg-emerald-600 text-white grid place-items-center" aria-hidden="true">
          <Icon className="size-4" />
        </div>
        <span className="text-sm font-medium">{label}</span>
      </div>
    </button>
  )
}

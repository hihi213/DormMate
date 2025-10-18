"use client"

import { useEffect, useState } from "react"
import { ArrowLeft, Plus, Clock, CheckCircle, XCircle, MoreVertical, Edit3, Trash2, Shirt } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { getCurrentUserId } from "@/lib/auth"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu"
import BottomNav from "@/components/bottom-nav"
import AuthGuard from "@/features/auth/components/auth-guard"

type LaundryItem = {
  id: string
  device: string
  startTime: string
  endTime: string
  status: "running" | "waiting" | "completed" | "cancelled"
  owner: string
  room: string
  notes?: string
}

const LAUNDRY_KEY = "laundry-items-v1"

export default function LaundryPage() {
  return (
    <AuthGuard>
      <LaundryInner />
      <BottomNav />
    </AuthGuard>
  )
}

function LaundryInner() {
  return (
    <main className="min-h-[100svh] bg-white">
      {/* Main page header (no back) */}
      <header className="sticky top-0 z-40 border-b bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="mx-auto max-w-screen-sm px-2 py-3 flex items-center">
          <div className="flex-1 text-center">
            <div className="inline-flex items-center gap-2">
              <Shirt className="size-4 text-teal-700" />
              <h1 className="text-base font-semibold leading-none">{"세탁기 현황"}</h1>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-screen-sm px-4 py-8 pb-28">
        <p className="text-sm text-muted-foreground">{"세탁 모듈은 곧 연결됩니다."}</p>
      </div>
    </main>
  )
}

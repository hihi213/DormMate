"use client"

import { useEffect, useState } from "react"
import { Shirt } from "lucide-react"
import { getCurrentUser } from "@/lib/auth"
import BottomNav from "@/components/bottom-nav"
import AuthGuard from "@/features/auth/components/auth-guard"
import HomeHeader from "@/app/_components/home/home-header"

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
  const currentUser = getCurrentUser()
  const isAdmin = currentUser?.roles.includes("ADMIN") ?? false
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <main className="min-h-[100svh] bg-white">
      <HomeHeader
        mounted={mounted}
        isLoggedIn={Boolean(currentUser)}
        user={currentUser}
        isAdmin={isAdmin}
        onOpenInfo={() => undefined}
        onLogout={() => {
          window.location.href = "/auth/logout"
        }}
        contextSlot={
          <div className="inline-flex items-center gap-2 text-sky-700">
            <Shirt className="h-5 w-5" aria-hidden />
            <span className="text-base font-semibold leading-none">세탁실</span>
          </div>
        }
      />

      <div className="mx-auto max-w-screen-sm px-4 py-8 pb-28">
        <p className="text-sm text-muted-foreground">{"세탁 모듈은 곧 도입 예정입니다."}</p>
      </div>
    </main>
  )
}

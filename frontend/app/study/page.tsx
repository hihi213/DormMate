"use client"

import { useEffect, useState } from "react"
import { DoorOpen } from "lucide-react"
import { getCurrentUser } from "@/lib/auth"
import BottomNav from "@/components/bottom-nav"
import AuthGuard from "@/features/auth/components/auth-guard"
import HomeHeader from "@/app/_components/home/home-header"

type StudyRoomItem = {
  id: string
  roomName: string
  date: string
  startTime: string
  endTime: string
  status: "reserved" | "completed" | "cancelled"
  notes?: string
}

const STUDY_KEY = "study-room-items-v1"

export default function StudyPage() {
  return (
    <AuthGuard>
      <StudyInner />
      <BottomNav />
    </AuthGuard>
  )
}

function StudyInner() {
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
          <div className="inline-flex items-center gap-2 text-violet-700">
            <DoorOpen className="h-5 w-5" aria-hidden />
            <span className="text-base font-semibold leading-none">스터디룸</span>
          </div>
        }
      />

      <div className="mx-auto max-w-screen-sm px-4 py-8 pb-28">
        <p className="text-sm text-muted-foreground">{"스터디룸 모듈은 곧 도입 예정입니다."}</p>
      </div>
    </main>
  )
}

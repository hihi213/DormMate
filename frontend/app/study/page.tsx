"use client"

import { useEffect, useState } from "react"
import { DoorOpen } from "lucide-react"
import { getCurrentUser } from "@/lib/auth"
import BottomNav from "@/components/bottom-nav"
import AuthGuard from "@/features/auth/components/auth-guard"
import UserServiceHeader from "@/app/_components/home/user-service-header"
import { ComingSoonCard } from "@/components/coming-soon-card"
import { useLogoutRedirect } from "@/hooks/use-logout-redirect"

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
  const logoutAndRedirect = useLogoutRedirect()

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <main className="min-h-[100svh] bg-white">
      <UserServiceHeader
        service="study"
        mounted={mounted}
        user={currentUser}
        isAdmin={isAdmin}
        onLogout={() => {
          void logoutAndRedirect()
        }}
      />

      <div className="mx-auto max-w-screen-sm px-4 py-8 pb-28">
        <ComingSoonCard
          badge="스터디룸"
          title="스터디룸 모듈 (준비 중)"
          description="예약 캘린더와 노쇼 처리 기능을 준비하고 있습니다."
          icon={<DoorOpen className="size-4" aria-hidden />}
          note="향후 Beta 테스트에 참가하고 싶다면 운영팀에 알려 주세요."
        />
      </div>
    </main>
  )
}

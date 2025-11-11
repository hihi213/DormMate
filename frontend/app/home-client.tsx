"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

import BottomNav from "@/components/bottom-nav"
import { useServiceWorkerRegistration } from "@/hooks/use-service-worker-registration"
import AnnouncementsCard from "./_components/home/announcements-card"
import HomeHeader from "./_components/home/home-header"
import LoginPromptCard from "./_components/home/login-prompt-card"
import ProfileDialog from "./_components/home/profile-dialog"
import { useHomeState } from "./_components/home/use-home-state"

function LoadingHome() {
  return (
    <div className="space-y-4">
      <div className="h-24 animate-pulse rounded-xl bg-slate-100" />
      <div className="h-20 animate-pulse rounded-xl bg-slate-100" />
      <div className="h-20 animate-pulse rounded-xl bg-slate-100" />
    </div>
  )
}

export default function HomePageClient() {
  const router = useRouter()
  useServiceWorkerRegistration()
  const { mounted, user, isLoggedIn, isAdmin, infoOpen, setInfoOpen, nextInspection, logout } = useHomeState()

  useEffect(() => {
    if (mounted && isAdmin) {
      router.replace("/admin")
    }
  }, [mounted, isAdmin, router])

  return (
    <main className="min-h-[100svh] bg-white text-gray-900">
      <HomeHeader
        mounted={mounted}
        isLoggedIn={isLoggedIn}
        user={user}
        isAdmin={isAdmin}
        onOpenInfo={() => setInfoOpen(true)}
        onLogout={logout}
      />

      <div className="mx-auto max-w-screen-sm px-4 pb-28 pt-3 space-y-6">
        {!mounted ? (
          <LoadingHome />
        ) : !isLoggedIn ? (
          <div className="space-y-6">
            <LoginPromptCard />
          </div>
        ) : (
          <div className="space-y-3">
            <AnnouncementsCard nextInspection={nextInspection} />
          </div>
        )}
      </div>

      <BottomNav />

      <ProfileDialog open={infoOpen} onOpenChange={setInfoOpen} isLoggedIn={isLoggedIn} user={user} />
    </main>
  )
}

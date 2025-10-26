"use client"

import BottomNav from "@/components/bottom-nav"

import AnnouncementsCard from "./_components/home/announcements-card"
import HomeHeader from "./_components/home/home-header"
import LoginPromptCard from "./_components/home/login-prompt-card"
import ProfileDialog from "./_components/home/profile-dialog"
import { useHomeState } from "./_components/home/use-home-state"
import { useServiceWorkerRegistration } from "@/hooks/use-service-worker-registration"

export default function Page() {
  useServiceWorkerRegistration()
  const {
    mounted,
    user,
    isLoggedIn,
    infoOpen,
    setInfoOpen,
    nextInspection,
    logout,
    resetDemoForUser,
    startDemoWithDefaultUser,
  } = useHomeState()

  return (
    <main className="min-h-[100svh] bg-white text-gray-900">
      <HomeHeader
        mounted={mounted}
        isLoggedIn={isLoggedIn}
        user={user}
        onOpenInfo={() => setInfoOpen(true)}
        onLogout={logout}
        onResetDemo={resetDemoForUser}
        onStartDemo={startDemoWithDefaultUser}
      />

      <div className="mx-auto max-w-screen-sm px-4 pb-28 pt-3 space-y-6">
        {!mounted || !isLoggedIn ? (
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

"use client"

import BottomNav from "@/components/bottom-nav"

import AnnouncementsCard from "./_components/home/announcements-card"
import HomeHeader from "./_components/home/home-header"
import LoginDialog from "./_components/home/login-dialog"
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
    loginOpen,
    setLoginOpen,
    infoOpen,
    setInfoOpen,
    loginId,
    setLoginId,
    loginPw,
    setLoginPw,
    loginErr,
    setLoginErr,
    nextInspection,
    handleLoginSubmit,
    logout,
    resetDemoForUser,
    startDemoWithDefaultUser,
  } = useHomeState()

  const handleLoginDialogChange = (open: boolean) => {
    setLoginOpen(open)
    if (!open) setLoginErr("")
  }

  return (
    <main className="min-h-[100svh] bg-white text-gray-900">
      <HomeHeader
        mounted={mounted}
        isLoggedIn={isLoggedIn}
        user={user}
        onOpenInfo={() => setInfoOpen(true)}
        onOpenLogin={() => setLoginOpen(true)}
        onLogout={logout}
        onResetDemo={resetDemoForUser}
        onStartDemo={startDemoWithDefaultUser}
      />

      <div className="mx-auto max-w-screen-sm px-4 pb-28 pt-3 space-y-6">
        {!mounted || !isLoggedIn ? (
          <div className="space-y-6">
            <LoginPromptCard onLoginClick={() => setLoginOpen(true)} />
          </div>
        ) : (
          <div className="space-y-3">
            <AnnouncementsCard nextInspection={nextInspection} />
          </div>
        )}
      </div>

      <BottomNav />

      <LoginDialog
        open={loginOpen}
        onOpenChange={handleLoginDialogChange}
        loginId={loginId}
        loginPw={loginPw}
        onChangeId={setLoginId}
        onChangePw={setLoginPw}
        onSubmit={handleLoginSubmit}
        error={loginErr}
      />

      <ProfileDialog open={infoOpen} onOpenChange={setInfoOpen} isLoggedIn={isLoggedIn} user={user} />
    </main>
  )
}

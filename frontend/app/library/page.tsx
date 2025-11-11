"use client"

import { useEffect, useState } from "react"
import { BookOpen } from "lucide-react"
import { getCurrentUser } from "@/lib/auth"
import BottomNav from "@/components/bottom-nav"
import AuthGuard from "@/features/auth/components/auth-guard"
import HomeHeader from "@/app/_components/home/home-header"

type BookItem = {
  id: string
  title: string
  author: string
  borrowDate: string
  returnDate: string
  status: "borrowed" | "returned" | "overdue"
  notes?: string
}

const LIBRARY_KEY = "library-items-v1"

export default function LibraryPage() {
  return (
    <AuthGuard>
      <LibraryInner />
      <BottomNav />
    </AuthGuard>
  )
}

function LibraryInner() {
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
          <div className="inline-flex items-center gap-2 text-amber-800">
            <BookOpen className="h-5 w-5" aria-hidden />
            <span className="text-base font-semibold leading-none">도서관</span>
          </div>
        }
      />

      <div className="mx-auto max-w-screen-sm px-4 py-8 pb-28">
        <p className="text-sm text-muted-foreground mt-1">{"도서 모듈은 곧 도입 예정입니다."}</p>
      </div>
    </main>
  )
}

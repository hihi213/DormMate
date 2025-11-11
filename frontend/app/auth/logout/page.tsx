"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"

import { logout, redirectToLogin } from "@/lib/auth"

export default function LogoutPage() {
  const router = useRouter()

  useEffect(() => {
    let mounted = true
    const performLogout = async () => {
      try {
        await logout()
      } finally {
        if (mounted) {
          router.replace(redirectToLogin("logout"))
        }
      }
    }
    void performLogout()
    return () => {
      mounted = false
    }
  }, [router])

  return (
    <div className="flex min-h-[100svh] items-center justify-center bg-gradient-to-b from-emerald-50 to-white px-6">
      <div className="flex flex-col items-center gap-4 rounded-3xl border border-emerald-100 bg-white/80 px-6 py-8 text-center shadow-lg shadow-emerald-100/70">
        <Loader2 className="size-6 animate-spin text-emerald-600" aria-hidden />
        <div>
          <p className="text-base font-medium text-slate-900">로그아웃 중입니다</p>
          <p className="mt-1 text-sm text-slate-500">잠시만 기다려 주세요.</p>
        </div>
      </div>
    </div>
  )
}

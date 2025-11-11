"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { User } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { getCurrentUser, subscribeAuth, redirectToLogin } from "@/lib/auth"

interface AuthGuardProps {
  children: React.ReactNode
  fallback?: React.ReactNode
}

export default function AuthGuard({ children, fallback }: AuthGuardProps) {
  const isFixtureEnv = process.env.NEXT_PUBLIC_FIXTURE === "1"
  const isFixtureRuntime = typeof window !== "undefined" && window.localStorage.getItem("dm.fixture") === "1"
  if (isFixtureEnv || isFixtureRuntime) {
    return <>{children}</>
  }

  const router = useRouter()
  const [user, setUser] = useState(getCurrentUser())
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const unsubscribe = subscribeAuth((next) => setUser(next))
    setUser(getCurrentUser())
    return () => unsubscribe()
  }, [])

  if (!mounted) {
    return null
  }

  if (!user) {
    if (fallback) {
      return <>{fallback}</>
    }

    const redirectTo =
      typeof window !== "undefined"
        ? `${window.location.pathname}${window.location.search ?? ""}${window.location.hash ?? ""}`
        : "/"

    return (
      <main className="min-h-[100svh] bg-white">
        <div className="mx-auto max-w-screen-sm px-4 py-20">
          <Card className="border-slate-200 bg-slate-50">
            <CardContent className="py-16 text-center">
              <div className="w-20 h-20 rounded-full bg-gray-100 mx-auto mb-6 flex items-center justify-center">
                <User className="w-10 h-10 text-gray-400" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-3">로그인이 필요합니다</h1>
              <p className="text-base text-gray-600 mb-8 max-w-md mx-auto">
                이 페이지를 이용하려면 로그인이 필요합니다.
                <br />
                기숙사 서비스에 로그인해주세요.
              </p>
              <div className="space-y-3">
                <Button
                  onClick={() => router.push(redirectToLogin({ redirect: redirectTo }))}
                  className="bg-emerald-600 hover:bg-emerald-700 w-full max-w-xs"
                  size="lg"
                >
                  로그인하러 가기
                </Button>
                <p className="text-sm text-gray-500">운영 계정 정보가 없다면 관리자에게 문의해 주세요.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    )
  }

  return <>{children}</>
}

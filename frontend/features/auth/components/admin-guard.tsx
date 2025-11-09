"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ShieldAlert } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { getCurrentUser, subscribeAuth } from "@/lib/auth"

interface AdminGuardProps {
  children: React.ReactNode
}

export default function AdminGuard({ children }: AdminGuardProps) {
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

  if (!user?.isAdmin) {
    return (
      <main className="min-h-[100svh] bg-white">
        <div className="mx-auto max-w-screen-sm px-4 py-20">
          <Card className="border-slate-200 bg-slate-50">
            <CardContent className="py-16 text-center">
              <div className="w-20 h-20 rounded-full bg-rose-50 mx-auto mb-6 flex items-center justify-center">
                <ShieldAlert className="w-10 h-10 text-rose-500" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-3">관리자 권한이 필요합니다</h1>
              <p className="text-base text-gray-600 mb-8 max-w-md mx-auto">
                이 페이지는 관리자 전용 기능입니다. 거주자/층별장 계정으로는 접근할 수 없습니다.
              </p>
              <Button
                onClick={() => router.replace("/")}
                className="bg-emerald-600 hover:bg-emerald-700 w-full max-w-xs"
                size="lg"
              >
                홈으로 돌아가기
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    )
  }

  return <>{children}</>
}

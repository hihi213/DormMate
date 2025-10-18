"use client"

import { useRouter } from "next/navigation"
import { User } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export default function LoginPromptCard() {
  const router = useRouter()

  const handleLoginClick = () => {
    const redirect = typeof window !== "undefined" ? window.location.pathname : "/"
    router.push(`/auth/login?redirect=${encodeURIComponent(redirect)}`)
  }

  return (
    <Card className="border-slate-200 bg-slate-50">
      <CardContent className="py-12 text-center">
        <div className="w-16 h-16 rounded-full bg-gray-100 mx-auto mb-4 flex items-center justify-center">
          <User className="w-8 h-8 text-gray-400" />
        </div>
        <h2 className="text-lg font-semibold text-gray-900 mb-2">{"로그인이 필요합니다"}</h2>
        <p className="text-sm text-gray-600 mb-4">{"기숙사 서비스를 이용하려면 로그인해주세요"}</p>
        <Button onClick={handleLoginClick} className="bg-emerald-600 hover:bg-emerald-700">
          {"로그인하기"}
        </Button>
      </CardContent>
    </Card>
  )
}

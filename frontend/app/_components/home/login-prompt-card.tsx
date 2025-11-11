"use client"

import { useRouter } from "next/navigation"
import { User, X } from "lucide-react"
import { useState } from "react"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { redirectToLogin } from "@/lib/auth"

export default function LoginPromptCard() {
  const [dismissed, setDismissed] = useState(false)
  const router = useRouter()

  if (dismissed) {
    return null
  }

  const handleLoginClick = () => {
    const redirect =
      typeof window !== "undefined" ? window.location.pathname + window.location.search : undefined
    router.push(redirectToLogin({ redirect }))
  }

  return (
    <Card className="border-slate-200 bg-slate-50">
      <CardContent className="pt-6 pb-10 text-center">
        <button
          type="button"
          className="ml-auto mb-2 flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          aria-label="닫기"
          onClick={() => setDismissed(true)}
        >
          <X className="size-4" />
        </button>
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

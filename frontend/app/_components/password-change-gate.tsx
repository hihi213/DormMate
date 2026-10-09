"use client"
import { useEffect, useState, type ReactNode } from "react"
import { usePathname, useRouter } from "next/navigation"
import { getCurrentUser, subscribeAuth } from "@/lib/auth"

export default function PasswordChangeGate({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [required, setRequired] = useState(false)
  useEffect(() => {
    setRequired(getCurrentUser()?.mustChangePassword ?? false)
    return subscribeAuth(user => setRequired(user?.mustChangePassword ?? false))
  }, [])
  const blocked = required && pathname !== "/auth/change-password" && pathname !== "/auth/logout"
  useEffect(() => { if (blocked) router.replace("/auth/change-password") }, [blocked, router])
  return blocked ? <p role="status" className="p-8">비밀번호 변경 화면으로 이동합니다.</p> : children
}

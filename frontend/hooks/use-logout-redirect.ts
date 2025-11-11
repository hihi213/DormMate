"use client"

import { useCallback } from "react"
import { useRouter } from "next/navigation"

import { logout, redirectToLogin } from "@/lib/auth"

type LogoutRedirectOptions = {
  redirect?: string
  reason?: string
}

export function useLogoutRedirect(defaultReason: string = "logout") {
  const router = useRouter()

  return useCallback(
    async (options?: LogoutRedirectOptions) => {
      await logout()
      const destination = redirectToLogin({
        reason: options?.reason ?? defaultReason,
        redirect: options?.redirect,
      })
      router.push(destination)
    },
    [defaultReason, router],
  )
}

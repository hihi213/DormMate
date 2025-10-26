"use client"

import type { ReactNode } from "react"

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-[100svh] bg-gradient-to-br from-emerald-50 via-white to-sky-50">
      <div className="relative mx-auto flex min-h-[100svh] w-full max-w-screen-lg items-center justify-center px-4 py-10">
        {children}
      </div>
    </div>
  )
}

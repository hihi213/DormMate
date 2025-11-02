"use client"

import Link from "next/link"
import type { ReactNode } from "react"
import { ArrowLeft, Settings2 } from "lucide-react"

import AuthGuard from "@/features/auth/components/auth-guard"
import BottomNav from "@/components/bottom-nav"
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbSeparator } from "@/components/ui/breadcrumb"

export default function AdminManageLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGuard>
      <main className="min-h-[100svh] bg-slate-50 pb-28">
        <header className="sticky top-0 z-40 border-b bg-white/85 backdrop-blur supports-[backdrop-filter]:bg-white/70">
          <div className="mx-auto flex max-w-screen-lg flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <Link
                href="/admin"
                className="flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 hover:border-emerald-400 hover:text-emerald-600"
              >
                <ArrowLeft className="size-3.5" aria-hidden />
                관리자 홈
              </Link>
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                <Settings2 className="size-4 text-emerald-600" aria-hidden />
                관리 허브
              </div>
            </div>
            <Breadcrumb className="text-xs text-muted-foreground">
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink href="/admin">관리자</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbLink href="/admin/manage">관리 허브</BreadcrumbLink>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>
        <div className="mx-auto w-full max-w-screen-lg px-4 py-6">{children}</div>
      </main>
      <BottomNav />
    </AuthGuard>
  )
}

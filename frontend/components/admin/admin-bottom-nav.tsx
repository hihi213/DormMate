"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { BellDot, LayoutDashboard, Snowflake, Users } from "lucide-react"
import type { LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

type NavItem = {
  key: string
  label: string
  href: string
  icon: LucideIcon
}

const NAV_ITEMS: NavItem[] = [
  { key: "dashboard", label: "대시보드", href: "/admin", icon: LayoutDashboard },
  { key: "fridge", label: "냉장고", href: "/admin/fridge", icon: Snowflake },
  { key: "users", label: "사용자", href: "/admin/users", icon: Users },
  { key: "notifications", label: "알림", href: "/admin/notifications", icon: BellDot },
]

type AdminBottomNavProps = {
  className?: string
}

export default function AdminBottomNav({ className }: AdminBottomNavProps) {
  const pathname = usePathname()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const currentPath = mounted ? pathname : "/admin"

  return (
    <nav
      aria-label="관리자 하단 내비게이션"
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur",
        className,
      )}
    >
      <ul className="mx-auto flex max-w-screen-md">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          const active =
            item.href === "/admin"
              ? currentPath === "/admin"
              : currentPath.startsWith(item.href)
          return (
            <li key={item.key} className="flex-1">
              <Link
                href={item.href}
                className={cn(
                  "flex h-14 flex-col items-center justify-center gap-1 text-[11px] font-medium",
                  active ? "text-emerald-700" : "text-slate-500 hover:text-emerald-600",
                )}
              >
                <Icon className="size-5" aria-hidden />
                <span>{item.label}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

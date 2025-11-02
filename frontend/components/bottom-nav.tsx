"use client"

import { useEffect, useMemo, useState } from "react"
import { usePathname } from "next/navigation"
import { BookOpen, DoorOpen, Home, Settings2, ShieldCheck, Shirt, Snowflake } from "lucide-react"
import type { LucideIcon } from "lucide-react"

import type { AuthUser } from "@/lib/auth"
import { getCurrentUser, subscribeAuth } from "@/lib/auth"
import { cn } from "@/lib/utils"

type NavItem = {
  key: string
  label: string
  icon: LucideIcon
  href: string
}

const BASE_ITEMS: NavItem[] = [
  { key: "fridge", label: "냉장고", icon: Snowflake, href: "/fridge" },
  { key: "laundry", label: "세탁실", icon: Shirt, href: "/laundry" },
  { key: "home", label: "홈", icon: Home, href: "/" },
  { key: "library", label: "도서관", icon: BookOpen, href: "/library" },
  { key: "study", label: "스터디룸", icon: DoorOpen, href: "/study" },
]

export default function BottomNav() {
  const pathname = usePathname()
  const [mounted, setMounted] = useState(false)
  const [user, setUser] = useState<AuthUser | null>(null)

  useEffect(() => {
    setMounted(true)
    const current = getCurrentUser()
    setUser(current)
    const unsubscribe = subscribeAuth(setUser)
    return () => unsubscribe()
  }, [])

  const items = useMemo(() => {
    const isAdmin = user?.roles?.includes("ADMIN")
    if (!isAdmin) return BASE_ITEMS
    const adminItems = BASE_ITEMS.map((item) =>
      item.key === "home"
        ? { ...item, label: "관리자 홈", icon: ShieldCheck, href: "/admin" }
        : item,
    )
    adminItems.push({
      key: "manage",
      label: "관리 허브",
      icon: Settings2,
      href: "/admin/manage",
    })
    return adminItems
  }, [user])

  const currentPath = mounted ? pathname : "/"

  return (
    <nav
      aria-label="하단 내비게이션"
      className={cn("fixed inset-x-0 bottom-0 z-40 border-t bg-white/90 backdrop-blur")}
    >
      <ul className="mx-auto flex max-w-screen-sm">
        {items.map((item) => {
          const active = item.href === "/" ? currentPath === "/" : currentPath.startsWith(item.href)
          const Icon = item.icon
          return (
            <li key={item.key} className="flex-1">
              <a
                href={item.href}
                className={cn(
                  "flex flex-col items-center justify-center h-14 gap-1 text-xs",
                  active ? "text-emerald-700" : "text-gray-600 hover:text-gray-900",
                )}
                aria-label={item.label}
              >
                <Icon className="size-6" aria-hidden="true" />
                <span className="sr-only">{item.label}</span>
              </a>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

"use client"

import { Home, Snowflake, Shirt, DoorOpen, BookOpen } from "lucide-react"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"

const items = [
  { label: "냉장고", icon: Snowflake, href: "/fridge" },
  { label: "세탁실", icon: Shirt, href: "/laundry" },
  { label: "홈", icon: Home, href: "/" },
  { label: "도서관", icon: BookOpen, href: "/library" },
  { label: "스터디룸", icon: DoorOpen, href: "/study" },
]

export default function BottomNav() {
  const pathname = usePathname()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // 서버 사이드에서는 기본값을 사용하고, 클라이언트에서만 실제 경로를 사용
  const currentPath = mounted ? pathname : "/"

  return (
    <nav
      aria-label="하단 내비게이션"
      className={cn("fixed bottom-0 inset-x-0 z-40 border-t bg-white/90 backdrop-blur")}
    >
      <ul className="mx-auto max-w-screen-sm grid grid-cols-5">
        {items.map((item) => {
          const active = item.href === "/" ? currentPath === "/" : currentPath.startsWith(item.href)
          return (
            <li key={item.label}>
              <a
                href={item.href}
                className={cn(
                  "flex flex-col items-center justify-center h-14 gap-1 text-xs", // taller, friendlier
                  active ? "text-emerald-700" : "text-gray-600 hover:text-gray-900",
                )}
                aria-label={item.label}
              >
                <item.icon className="size-6" aria-hidden="true" />
                <span className="sr-only">{item.label}</span>
              </a>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

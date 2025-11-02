"use client"

import { Children, isValidElement, type ComponentType, type ReactNode, type SVGProps, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  BellDot,
  BookOpen,
  CalendarDays,
  FileBarChart2,
  LayoutDashboard,
  Menu,
  Search,
  Settings2,
  ShieldCheck,
  Snowflake,
  Users,
  Waves,
  X,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { getCurrentUser, logout, subscribeAuth, type AuthUser } from "@/lib/auth"

type NavItem = {
  label: string
  href: string
  icon: ComponentType<SVGProps<SVGSVGElement>>
  description?: string
}

type NavGroup = {
  label: string
  items: NavItem[]
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: "대시보드",
    items: [{ label: "대시보드", href: "/admin", icon: LayoutDashboard }],
  },
  {
    label: "입주자 & 제재",
    items: [
      { label: "입주자·제재", href: "/admin/users", icon: Users },
    ],
  },
  {
    label: "시설 모듈",
    items: [
      { label: "냉장고", href: "/admin/fridge", icon: Snowflake },
      { label: "세탁실", href: "/admin/laundry", icon: Waves },
      { label: "도서관", href: "/admin/library", icon: BookOpen },
      { label: "다목적실", href: "/admin/multipurpose", icon: CalendarDays },
    ],
  },
  {
    label: "운영 도구",
    items: [
      { label: "알림·정책", href: "/admin/notifications", icon: BellDot },
      { label: "시스템 설정", href: "/admin/system", icon: Settings2 },
      { label: "감사 로그 & 리포트", href: "/admin/audit", icon: FileBarChart2 },
    ],
  },
]

function useAuthUser() {
  const [user, setUser] = useState<AuthUser | null>(() => getCurrentUser())

  useEffect(() => {
    const unsubscribe = subscribeAuth(setUser)
    setUser(getCurrentUser())
    return () => unsubscribe()
  }, [])

  return user
}

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()

  return (
    <nav className="flex flex-1 flex-col gap-6 px-4 py-6 text-sm">
      {NAV_GROUPS.map((group) => (
        <div key={group.label} className="space-y-3">
          <p className="px-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
            {group.label}
          </p>
          <ul className="space-y-1.5">
            {group.items.map((item) => {
              const Icon = item.icon
              const isActive =
                pathname === item.href ||
                (item.href !== "/admin" && pathname.startsWith(`${item.href}/`))
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    className={cn(
                      "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2",
                      isActive
                        ? "bg-emerald-100 text-emerald-700 shadow-sm ring-1 ring-emerald-200"
                        : "text-slate-600 hover:bg-emerald-50 hover:text-emerald-700",
                    )}
                  >
                    <span className={cn("rounded-md border border-transparent p-1 transition", isActive ? "bg-emerald-600 text-white shadow" : "bg-white text-emerald-600 group-hover:border-emerald-200")}>
                      <Icon className="size-4" aria-hidden />
                    </span>
                    <span>{item.label}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </nav>
  )
}

type AdminShellProps = {
  children: React.ReactNode
}

export default function AdminShell({ children }: AdminShellProps) {
  const router = useRouter()
  const pathname = usePathname()
  const user = useAuthUser()
  const [searchKeyword, setSearchKeyword] = useState("")
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  const { mainContent, railContent } = useMemo(() => {
    const nodes = Children.toArray(children)
    const mains: ReactNode[] = []
    let rail: ReactNode | null = null

    nodes.forEach((node) => {
      if (isValidElement(node)) {
        const slot = (node.props as Record<string, unknown>)["data-admin-slot"]
        if (slot === "rail") {
          rail = node
          return
        }
        if (slot === "main") {
          mains.push(node)
          return
        }
      }
      mains.push(node)
    })

    return {
      mainContent: mains.length === 1 ? mains[0] : <>{mains}</>,
      railContent: rail,
    }
  }, [children])

  // 검색은 추후 API 연동 예정 — 현재는 콘솔 로그만 남긴다.
  const handleSearchSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (searchKeyword.trim().length === 0) return
    console.info("[AdminSearch] 검색 시도:", searchKeyword.trim())
  }

  const userInitials = useMemo(() => {
    if (!user?.name) return "A"
    const parts = user.name.trim().split(" ")
    if (parts.length === 1) {
      return parts[0].slice(0, 2).toUpperCase()
    }
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
  }, [user?.name])

  const handleLogout = async () => {
    await logout()
    router.push("/auth/login?redirect=/admin")
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="flex min-h-screen w-full">
        <aside className="hidden w-[260px] flex-col border-r border-slate-200 bg-white lg:flex">
          <div className="flex items-center gap-3 border-b border-slate-200 px-5 py-4">
            <span className="rounded-full bg-emerald-100 p-2">
              <ShieldCheck className="size-5 text-emerald-600" aria-hidden />
            </span>
            <div>
              <p className="text-sm font-semibold text-slate-900">DormMate Admin</p>
              <p className="text-xs text-slate-500">운영 허브</p>
            </div>
          </div>
          <NavList />
        </aside>

        <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="absolute left-3 top-3 z-40 rounded-full bg-white shadow lg:hidden"
              aria-label="관리자 내비게이션 열기"
            >
              <Menu className="size-5" aria-hidden />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[260px] p-0">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div className="flex items-center gap-3">
                <span className="rounded-full bg-emerald-100 p-2">
                  <ShieldCheck className="size-5 text-emerald-600" aria-hidden />
                </span>
                <p className="text-sm font-semibold text-slate-900">DormMate Admin</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setMobileNavOpen(false)} aria-label="내비게이션 닫기">
                <X className="size-5" aria-hidden />
              </Button>
            </div>
            <NavList onNavigate={() => setMobileNavOpen(false)} />
          </SheetContent>
        </Sheet>

        <div className="flex flex-1 flex-col">
          <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
            <div className="flex items-center justify-between gap-4 px-6 py-4">
              <div className="flex items-center gap-3 lg:hidden">
                <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center">
                  <ShieldCheck className="size-5 text-emerald-600" aria-hidden />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">DormMate Admin</p>
                  <p className="text-xs text-slate-500">운영 허브</p>
                </div>
              </div>
              <form
                onSubmit={handleSearchSubmit}
                className="relative hidden w-full max-w-xl items-center lg:flex"
                role="search"
                aria-label="관리자 전역 검색"
              >
                <Search className="pointer-events-none absolute left-3 size-4 text-slate-400" aria-hidden />
                <Input
                  value={searchKeyword}
                  onChange={(event) => setSearchKeyword(event.target.value)}
                  className="h-10 rounded-full border-slate-200 bg-slate-50 pl-10 pr-4 text-sm shadow-inner focus:border-emerald-500 focus:ring-emerald-500"
                  placeholder="호실, 사용자, 스티커 코드 검색"
                />
              </form>
              <div className="ml-auto flex items-center gap-3">
                <Button variant="ghost" size="icon" className="relative">
                  <BellDot className="size-5 text-emerald-600" aria-hidden />
                  <span className="sr-only">알림 확인</span>
                  <span className="absolute right-1 top-1 inline-flex size-2 rounded-full bg-emerald-500" />
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="flex items-center gap-3 rounded-full px-2 py-1">
                      <Avatar className="size-9 border border-emerald-100 bg-emerald-50 text-emerald-700">
                        <AvatarFallback className="text-sm font-semibold">{userInitials}</AvatarFallback>
                      </Avatar>
                      <div className="hidden text-left sm:block">
                        <p className="text-sm font-semibold text-slate-900">{user?.name ?? "관리자"}</p>
                        <p className="text-xs text-slate-500">{user?.room ?? "운영 계정"}</p>
                      </div>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56" align="end" forceMount>
                    <DropdownMenuLabel>
                      <div className="space-y-1 text-sm">
                        <p className="font-semibold text-slate-900">{user?.name ?? "관리자"}</p>
                        <p className="text-xs text-slate-500">{user?.loginId ?? "admin"}</p>
                        {user?.roles?.length ? (
                          <p className="text-xs text-emerald-600">
                            {user.roles.includes("ADMIN") ? "ADMIN" : user.roles.join(", ")}
                          </p>
                        ) : null}
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href="/admin">운영 대시보드</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/admin/users">사용자 & 역할 관리</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/admin/notifications">알림 정책</Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleLogout}>로그아웃</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
            <div className="px-6 pb-4 lg:hidden">
              <form onSubmit={handleSearchSubmit} className="relative" role="search" aria-label="관리자 전역 검색(모바일)">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
                <Input
                  value={searchKeyword}
                  onChange={(event) => setSearchKeyword(event.target.value)}
                  className="h-10 rounded-full border-slate-200 bg-slate-50 pl-10 pr-4 text-sm shadow-inner focus:border-emerald-500 focus:ring-emerald-500"
                  placeholder="호실, 사용자, 스티커 코드 검색"
                />
              </form>
            </div>
          </header>

          <div className="flex flex-1">
            <main className="flex-1 overflow-y-auto">
              <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-8 lg:px-10">
                {mainContent}
              </div>
            </main>
            <aside className="hidden w-72 border-l border-slate-200 bg-white/80 px-6 py-8 xl:block">
              {railContent ?? (
                <div className="space-y-4">
                  <h2 className="text-sm font-semibold text-slate-800">운영 퀵 액션</h2>
                  <p className="text-xs text-slate-500">
                    각 화면에서 제공하는 빠른 실행 카드가 없을 경우, 기본 안내를 표시합니다.
                  </p>
                  <Separator />
                  <ul className="space-y-3 text-sm text-slate-600">
                    <li>
                      <span className="font-medium text-slate-800">TIP.</span> 좌측 메뉴에서 모듈을 선택하고 우측 패널로 상세 조치를 이어가세요.
                    </li>
                    <li>감사 로그에서 모든 조치 이력을 확인할 수 있습니다.</li>
                    <li>위험 작업은 정책에 따라 2단계 확인을 요구합니다.</li>
                  </ul>
                </div>
              )}
            </aside>
          </div>
        </div>
      </div>
    </div>
  )
}

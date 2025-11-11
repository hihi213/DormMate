"use client"

import {
  Children,
  isValidElement,
  type ComponentType,
  type ReactNode,
  type SVGProps,
  useEffect,
  useMemo,
  useState,
} from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { BellDot, BookOpen, CalendarDays, FileBarChart2, Info, LayoutDashboard, ShieldCheck, Snowflake, Users, Waves } from "lucide-react"

import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import { getCurrentUser, logout, redirectToLogin, subscribeAuth, type AuthUser } from "@/lib/auth"
import HeaderNotifications from "@/components/admin/header-notifications"
import { useToast } from "@/hooks/use-toast"
import { resetDemoDataset } from "@/lib/demo-seed"
import AdminBottomNav from "@/components/admin/admin-bottom-nav"

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
    items: [{ label: "입주자·제재", href: "/admin/users", icon: Users }],
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
      { label: "권한·계정", href: "/admin/users", icon: Users },
      { label: "알림·정책", href: "/admin/notifications", icon: BellDot },
      { label: "감사 로그", href: "/admin/audit", icon: FileBarChart2 },
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
    <nav
      className="flex flex-1 flex-col gap-6 px-4 py-6 text-sm"
      aria-label="관리자 주요 내비게이션"
    >
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
  const [railSheetOpen, setRailSheetOpen] = useState(false)
  const [isResettingDemo, setIsResettingDemo] = useState(false)
  const { toast } = useToast()

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

  const handleDemoReset = async () => {
    if (isResettingDemo) {
      return
    }
    const confirmed = typeof window === "undefined" ? false : window.confirm("데모 데이터를 초기화하면 현재까지의 모든 시연 데이터가 삭제되고 기본 상태로 되돌아갑니다. 계속 진행할까요?")
    if (!confirmed) {
      return
    }

    setIsResettingDemo(true)
    try {
      await resetDemoDataset()
      toast({
        title: "데모 데이터가 초기화되었습니다.",
        description: "재접속하거나 목록을 새로고침하면 최신 상태를 확인할 수 있습니다.",
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : "데모 데이터를 초기화하지 못했습니다."
      toast({
        variant: "destructive",
        title: "초기화 실패",
        description: message,
      })
    } finally {
      setIsResettingDemo(false)
    }
  }

  const userInitials = useMemo(() => {
    if (!user?.name) return "A"
    const raw = user.name.trim()
    if (raw.length === 0) return "A"

    const KOREAN_CHAR_REGEX = /[\uac00-\ud7a3]/
    const parts = raw.split(/\s+/)
    const lastPart = parts[parts.length - 1] ?? raw

    if (KOREAN_CHAR_REGEX.test(lastPart)) {
      return lastPart.slice(0, 1)
    }

    if (parts.length === 1) {
      return parts[0].slice(0, 2).toUpperCase()
    }

    const initials = `${parts[0][0] ?? ""}${lastPart[0] ?? ""}`
    return initials.toUpperCase()
  }, [user?.name])

  const handleLogout = async () => {
    await logout()
    router.push(redirectToLogin({ reason: "logout", redirect: "/admin" }))
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <a
        href="#admin-main-content"
        className="sr-only focus-visible:not-sr-only focus-visible:absolute focus-visible:left-4 focus-visible:top-4 focus-visible:z-50 focus-visible:rounded-md focus-visible:bg-emerald-600 focus-visible:px-4 focus-visible:py-2 focus-visible:text-white"
      >
        본문으로 건너뛰기
      </a>
      <div className="flex min-h-screen w-full">
        <aside className="hidden w-[260px] flex-col border-r border-slate-200 bg-white lg:flex lg:sticky lg:top-0 lg:h-screen lg:shrink-0">
          <div className="flex items-center gap-3 border-b border-slate-200 px-5 py-4">
            <span className="rounded-full bg-emerald-100 p-2">
              <ShieldCheck className="size-5 text-emerald-600" aria-hidden />
            </span>
            <div>
              <p className="text-sm font-semibold text-slate-900">DormMate Admin</p>
              <p className="text-xs text-slate-500">운영 허브</p>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto pb-8">
            <NavList />
          </div>
        </aside>

        <div className="flex flex-1 flex-col">
          <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
            <div className="flex items-center justify-between gap-4 px-6 py-4">
              <div className="flex items-center gap-2 lg:hidden">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100">
                  <ShieldCheck className="size-5 text-emerald-600" aria-hidden />
                </span>
                <div>
                  <p className="text-sm font-semibold text-slate-900">DormMate Admin</p>
                  <p className="text-xs text-slate-500">운영 허브</p>
                </div>
              </div>
              <div className="ml-auto flex items-center gap-3">
                <HeaderNotifications />
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
                    <DropdownMenuItem asChild>
                      <Link href="/admin/audit">감사 로그</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={(event) => {
                        event.preventDefault()
                        void handleDemoReset()
                      }}
                      disabled={isResettingDemo}
                    >
                      {isResettingDemo ? "데모 초기화 중..." : "데모 데이터 초기화"}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleLogout}>로그아웃</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </header>

          <div className="flex flex-1">
            <main id="admin-main-content" className="flex-1 overflow-y-auto" role="main">
              <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pb-28 pt-8 sm:px-6 lg:px-10 lg:pb-12">
                {mainContent}
              </div>
            </main>
            {railContent ? (
              <>
                <aside
                  className="hidden w-72 border-l border-slate-200 bg-white/80 px-6 py-8 xl:block"
                  role="complementary"
                  aria-label="관리자 보조 패널"
                >
                  {railContent}
                </aside>
                <Sheet open={railSheetOpen} onOpenChange={setRailSheetOpen}>
                  <SheetTrigger asChild>
                    <Button
                      type="button"
                      size="icon"
                      aria-label="운영 런북 열기"
                      className="fixed bottom-20 right-4 z-40 rounded-full bg-emerald-600 text-white shadow-lg transition hover:bg-emerald-500 lg:hidden"
                    >
                      <Info className="size-5" aria-hidden />
                    </Button>
                  </SheetTrigger>
                  <SheetContent
                    side="bottom"
                    className="h-[80vh] overflow-y-auto px-4 py-6"
                    aria-label="운영 보조 정보"
                  >
                    <SheetHeader className="sr-only">
                      <SheetTitle>운영 보조 정보</SheetTitle>
                      <SheetDescription>운영 런북과 참고 정보를 확인하세요</SheetDescription>
                    </SheetHeader>
                    <div className="mx-auto max-w-xl space-y-6">{railContent}</div>
                  </SheetContent>
                </Sheet>
              </>
            ) : null}
          </div>
        </div>
      </div>
      <AdminBottomNav className="lg:hidden" />
    </div>
  )
}

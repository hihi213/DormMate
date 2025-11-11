"use client"

import { Suspense, useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { ArrowLeft, Sparkles } from "lucide-react"

import { Button } from "@/components/ui/button"
import { LoginPanel } from "@/features/auth/components/login-panel"
import { getAuthReasonMessage } from "@/features/auth/utils/messages"

type Mode = "login" | "signup"

export default function AuthPortalPage() {
  return (
    <Suspense
      fallback={
        <div className="relative w-full max-w-[440px]">
          <div className="absolute inset-x-6 -top-6 h-24 rounded-full bg-emerald-200/40 blur-3xl" aria-hidden="true" />
          <div className="relative overflow-hidden rounded-[28px] bg-white/80 shadow-[0_40px_80px_-30px_rgba(16,185,129,0.25)] backdrop-blur-sm ring-1 ring-white/60">
            <div className="flex flex-col gap-6 px-7 py-10">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                    <Sparkles className="size-3.5 animate-pulse" />
                    DormMate
                  </span>
                  <div className="h-6 w-32 rounded bg-emerald-100/60" />
                  <div className="h-4 w-48 rounded bg-emerald-50" />
                </div>
                <div className="h-7 w-24 rounded-full border border-emerald-100 bg-white/70" />
              </div>
              <div className="space-y-4">
                <div className="h-12 rounded-lg bg-emerald-50" />
                <div className="h-12 rounded-lg bg-emerald-50/80" />
                <div className="h-24 rounded-xl bg-emerald-50/60" />
              </div>
            </div>
          </div>
        </div>
      }
    >
      <AuthPortalContent />
    </Suspense>
  )
}

function AuthPortalContent() {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()

  const queryMode = params.get("mode") === "signup" ? "signup" : "login"
  const [mode, setMode] = useState<Mode>(queryMode)

  const redirectTo = useMemo(() => params.get("redirect") ?? "/", [params])
  const reasonKey = params.get("reason")
  const reasonMessage = useMemo(() => getAuthReasonMessage(reasonKey), [reasonKey])

  useEffect(() => {
    setMode(queryMode)
  }, [queryMode])

  const updateQuery = useCallback(
    (nextMode: Mode) => {
      const query = new URLSearchParams(params.toString())
      query.set("mode", nextMode)
      router.replace(`${pathname}?${query.toString()}`, { scroll: false })
      setMode(nextMode)
    },
    [params, pathname, router],
  )

  const activeDescription =
    mode === "login"
      ? "기숙사 공용 시설 관리를 한곳에서."
      : "온라인 회원가입은 일시 중단되었습니다. 관리자에게 문의해 주세요."

  return (
    <div className="relative w-full max-w-[440px]">
      <div className="absolute inset-x-6 -top-6 h-24 rounded-full bg-emerald-200/40 blur-3xl" aria-hidden="true" />
      <div className="relative overflow-hidden rounded-[28px] bg-white/90 shadow-[0_40px_80px_-30px_rgba(16,185,129,0.35)] backdrop-blur-sm ring-1 ring-white/60">
        <div className="absolute -right-10 -top-10 size-32 rounded-full bg-emerald-100 blur-2xl" aria-hidden="true" />
        <div className="absolute -bottom-12 -left-6 size-40 rounded-full bg-sky-100 blur-2xl" aria-hidden="true" />
        <div className="relative flex flex-col gap-8 px-7 py-8">
          <header className="flex items-start justify-between">
            <div className="space-y-1">
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                <Sparkles className="size-3.5" />
                DormMate
              </span>
              <h1 className="text-2xl font-semibold text-gray-900">
                {mode === "login" ? "로그인" : "회원가입"}
              </h1>
              <p className="text-sm text-gray-500">{activeDescription}</p>
            </div>

            <Link
              href="/"
              className="inline-flex items-center gap-1 rounded-full border border-transparent bg-white/80 px-3 py-1.5 text-xs font-medium text-emerald-700 shadow-sm transition hover:border-emerald-200 hover:shadow"
            >
              <ArrowLeft className="size-4" />
              {"메인으로"}
            </Link>
          </header>

          {reasonMessage && (
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-800">
              {reasonMessage}
            </div>
          )}

          <div className="relative min-h-[420px]">
            {mode === "login" && <LoginPanel redirectTo={redirectTo} />}
            {mode === "signup" && <SignupDisabledPanel onBackToLogin={() => updateQuery("login")} />}
          </div>
        </div>
      </div>
    </div>
  )
}

type SignupDisabledPanelProps = {
  onBackToLogin: () => void
}

function SignupDisabledPanel({ onBackToLogin }: SignupDisabledPanelProps) {
  return (
    <div className="flex h-full flex-col justify-between rounded-2xl border border-dashed border-emerald-200 bg-emerald-50/70 px-6 py-8 text-center text-sm text-emerald-900">
      <div className="space-y-3">
        <p className="text-base font-semibold text-emerald-800">온라인 회원가입 준비 중</p>
        <p className="text-sm leading-relaxed text-emerald-700">
          DormMate 계정 발급은 현재 기숙사 행정실을 통해서만 처리됩니다.
          <br />
          관리자에게 문의해 계정을 발급받은 뒤 로그인해 주세요.
        </p>
      </div>
      <Button
        type="button"
        variant="outline"
        className="mt-6 w-full rounded-xl border-emerald-300 text-emerald-800 hover:bg-emerald-100"
        onClick={onBackToLogin}
      >
        로그인 화면으로 이동
      </Button>
    </div>
  )
}

"use client"

import { useEffect, useRef, useState, useTransition, useMemo, useCallback } from "react"
import { Eye, EyeOff, Loader2 } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import { ensureValidAccessToken, getCurrentUser, loginWithCredentials } from "@/lib/auth"
import type { AuthUser } from "@/lib/auth"

type LoginPanelProps = {
  redirectTo: string
}

const inputStyle =
  "h-11 rounded-xl border border-slate-200 bg-white/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:border-emerald-500 transition"

export function LoginPanel({ redirectTo }: LoginPanelProps) {
  const router = useRouter()
  const params = useSearchParams()
  const { toast } = useToast()

  // redirect query 우선 사용
  const explicitRedirect = useMemo(() => params.get("redirect"), [params])
  const finalRedirect = useMemo(() => explicitRedirect ?? redirectTo ?? "/", [explicitRedirect, redirectTo])

  const [loginId, setLoginId] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [pending, startTransition] = useTransition()
  const errorRegionRef = useRef<HTMLParagraphElement | null>(null)

  const idInputRef = useRef<HTMLInputElement | null>(null)

  const resolveTarget = useCallback(
    (current: AuthUser | null) => {
      if (current?.isAdmin) {
        if (explicitRedirect && explicitRedirect.startsWith("/admin")) {
          return explicitRedirect
        }
        return "/admin"
      }
      return finalRedirect || "/"
    },
    [explicitRedirect, finalRedirect],
  )

  useEffect(() => {
    let cancelled = false
    const maybeRedirect = async () => {
      const current = getCurrentUser()
      if (!current) return
      const accessToken = await ensureValidAccessToken()
      if (!accessToken || cancelled) {
        return
      }
      router.replace(resolveTarget(getCurrentUser()))
    }
    void maybeRedirect()
    return () => {
      cancelled = true
    }
  }, [router, resolveTarget])

  useEffect(() => {
    idInputRef.current?.focus()
  }, [])

  useEffect(() => {
    if (error) {
      errorRegionRef.current?.focus()
    }
  }, [error])

  const handleSubmit = () => {
    if (!loginId.trim()) {
      setError("아이디를 입력해 주세요.")
      return
    }
    if (!password.trim()) {
      setError("비밀번호를 입력해 주세요.")
      return
    }
    setError("")
    startTransition(async () => {
      try {
        const current = await loginWithCredentials({ id: loginId.trim(), password: password.trim() })
        toast({
          title: "로그인 완료",
          description: "DormMate에 오신 것을 환영합니다.",
        })
        router.replace(resolveTarget(current ?? null))
      } catch (err) {
        setError(err instanceof Error ? err.message : "로그인에 실패했습니다. 다시 시도해 주세요.")
      }
    })
  }

  return (
    <form
      className="space-y-6"
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        handleSubmit()
      }}
    >
      <div className="space-y-2">
        <label htmlFor="login-id" className="text-sm font-medium text-gray-800">
          {"아이디"}
        </label>
        <Input
          id="login-id"
          ref={idInputRef}
          value={loginId}
          onChange={(event) => {
            setLoginId(event.target.value)
            setError("")
          }}
          placeholder="예: dormmate01"
          autoComplete="username"
          className={inputStyle}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "login-error-message" : undefined}
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="login-password" className="text-sm font-medium text-gray-800">
          {"비밀번호"}
        </label>
        <div className="relative">
          <Input
            id="login-password"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(event) => {
              setPassword(event.target.value)
              setError("")
            }}
            placeholder="비밀번호를 입력하세요"
            autoComplete="current-password"
            className={inputStyle}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "login-error-message" : undefined}
          />
          <button
            type="button"
            className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-500 transition hover:text-gray-700"
            aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 표시"}
            onClick={() => setShowPassword((prev) => !prev)}
          >
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </div>

      <p
        id="login-error-message"
        ref={errorRegionRef}
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
        tabIndex={error ? -1 : undefined}
        className={`min-h-[1.25rem] text-sm font-medium text-rose-600 ${error ? "" : "sr-only"}`}
      >
        {error ? error : " "}
      </p>

      <Button
        type="submit"
        className="w-full h-11 rounded-xl bg-emerald-600 font-semibold shadow-lg shadow-emerald-600/20 transition hover:bg-emerald-700"
        onClick={handleSubmit}
        disabled={pending}
      >
        {pending && <Loader2 className="mr-2 size-4 animate-spin" />}
        {"로그인"}
      </Button>
      <p className="text-xs text-gray-500">
        {"계정을 발급받지 않았다면 기숙사 관리자에게 문의해 주세요."}
      </p>

    </form>
  )
}

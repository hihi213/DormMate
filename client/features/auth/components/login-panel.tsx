"use client"

import { useEffect, useRef, useState, useTransition, useMemo } from "react"
import { Eye, EyeOff, Loader2 } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import { DEMO_ACCOUNTS, getCurrentUser, loginWithCredentials } from "@/lib/auth"

type LoginPanelProps = {
  redirectTo: string
  onSwitchToSignup: () => void
}

const inputStyle =
  "h-11 rounded-xl border border-slate-200 bg-white/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:border-emerald-500 transition"

export function LoginPanel({ redirectTo, onSwitchToSignup }: LoginPanelProps) {
  const router = useRouter()
  const params = useSearchParams()
  const { toast } = useToast()

  // redirect query 우선 사용
  const finalRedirect = useMemo(() => params.get("redirect") ?? redirectTo ?? "/", [params, redirectTo])

  const [loginId, setLoginId] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [pending, startTransition] = useTransition()
  const errorRegionRef = useRef<HTMLParagraphElement | null>(null)

  const idInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    const current = getCurrentUser()
    if (current) {
      router.replace(finalRedirect)
    }
  }, [router, finalRedirect])

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
        await loginWithCredentials({ id: loginId.trim(), password: password.trim() })
        toast({
          title: "로그인 완료",
          description: "DormMate에 오신 것을 환영합니다.",
        })
        router.replace(finalRedirect || "/")
      } catch (err) {
        setError(err instanceof Error ? err.message : "로그인에 실패했습니다. 다시 시도해 주세요.")
      }
    })
  }

  const fillDemoAccount = (id: string) => {
    setLoginId(id)
    setPassword(id)
    setError("")
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

      <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 px-4 py-3 text-xs text-emerald-800 shadow-inner">
        <p className="font-semibold">{"테스트 계정 체험"}</p>
        <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
          {DEMO_ACCOUNTS.map((account) => (
            <button
              key={account.id}
              type="button"
              onClick={() => fillDemoAccount(account.id)}
              className="rounded-full border border-emerald-200 bg-white px-3 py-1 font-medium text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-100"
            >
              {`${account.id} / ${account.id} · ${account.room}`}
            </button>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={onSwitchToSignup}
        className="w-full text-center text-sm font-medium text-emerald-700 hover:underline"
      >
        {"계정이 없으신가요? 회원가입하기"}
      </button>
    </form>
  )
}

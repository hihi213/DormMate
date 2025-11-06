"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { Eye, EyeOff, Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import { getCurrentUser, registerUser } from "@/lib/auth"

const STEP_LABELS = ["기본 정보", "계정 정보", "연락처 및 동의"] as const
type Step = 0 | 1 | 2

const inputStyle =
  "h-11 rounded-xl border border-slate-200 bg-white/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:border-emerald-500 transition"

type SignupPanelProps = {
  redirectTo: string
  onSwitchToLogin: () => void
}

export function SignupPanel({ redirectTo, onSwitchToLogin }: SignupPanelProps) {
  const router = useRouter()
  const { toast } = useToast()

  const [step, setStep] = useState<Step>(0)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const nameRef = useRef<HTMLInputElement | null>(null)
  const loginIdRef = useRef<HTMLInputElement | null>(null)
  const errorRegionRef = useRef<HTMLParagraphElement | null>(null)

  const [form, setForm] = useState({
    name: "",
    roomNumber: "",
    personalNo: "",
    loginId: "",
    password: "",
    confirmPassword: "",
    email: "",
    phone: "",
    agreeTerms: true,
    agreePolicy: true,
  })

  useEffect(() => {
    const current = getCurrentUser()
    if (current) {
      router.replace(redirectTo)
    }
  }, [router, redirectTo])

  useEffect(() => {
    if (step === 0) nameRef.current?.focus()
    if (step === 1) loginIdRef.current?.focus()
  }, [step])

  useEffect(() => {
    if (error) {
      errorRegionRef.current?.focus()
    }
  }, [error])

  const updateForm = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setError("")
  }

  const validateIdentity = () => {
    if (!form.name.trim()) return "이름을 입력해 주세요."
    if (!/^[가-힣a-zA-Z\s]{2,}$/.test(form.name.trim())) return "이름은 2자 이상 한글 또는 영문으로 입력해 주세요."
    if (!form.roomNumber.trim()) return "호실 번호를 입력해 주세요. 예: 301"
    if (!/^\d{3}$/.test(form.roomNumber.trim())) return "호실 번호는 숫자 3자리로 입력해 주세요."
    if (!form.personalNo.trim()) return "개인 번호를 선택해 주세요."
    if (!["1", "2", "3"].includes(form.personalNo.trim())) return "개인 번호는 1~3 사이의 숫자를 선택해 주세요."
    return ""
  }

  const validateAccount = () => {
    const normalizedId = form.loginId.trim().toLowerCase()
    if (!normalizedId) return "로그인 아이디를 입력해 주세요."
    if (!/^[a-z0-9._-]{3,20}$/.test(normalizedId)) {
      return "아이디는 영문 소문자, 숫자, 특수문자(._-) 조합 3~20자로 입력해 주세요."
    }
    if (!form.password) return "비밀번호를 입력해 주세요."
    if (form.password.length < 6) return "비밀번호는 6자 이상으로 설정해 주세요."
    if (!/[a-zA-Z]/.test(form.password) || !/\d/.test(form.password)) return "비밀번호는 영문과 숫자를 포함해야 합니다."
    if (form.password !== form.confirmPassword) return "비밀번호가 일치하지 않습니다."
    return ""
  }

  const validateContact = () => {
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return "올바른 이메일 주소 형식이 아닙니다."
    if (form.phone && !/^01[0-9]-?\d{3,4}-?\d{4}$/.test(form.phone.trim())) return "연락처는 010-1234-5678 형식으로 입력해 주세요."
    if (!form.agreeTerms || !form.agreePolicy) return "DormMate 이용약관 및 개인정보 처리방침에 동의해 주세요."
    return ""
  }

  const handleNext = () => {
    const message = step === 0 ? validateIdentity() : validateAccount()
    if (message) {
      setError(message)
      return
    }
    setError("")
    setStep((step + 1) as Step)
  }

  const handleRegister = () => {
    const message = validateContact()
    if (message) {
      setError(message)
      return
    }
    setError("")
    startTransition(async () => {
      try {
        await registerUser()
        toast({
          title: "회원가입 완료",
          description: `${form.name.trim()}님, DormMate에 오신 것을 환영합니다.`,
        })
        router.replace(redirectTo || "/")
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "회원가입 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.",
        )
      }
    })
  }

  const isIdentityStep = step === 0
  const isAccountStep = step === 1
  const isContactStep = step === 2
  const errorMessageId = "signup-error-message"

  return (
    <form
      className="space-y-6"
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        if (step < 2) {
          handleNext()
        } else {
          handleRegister()
        }
      }}
    >
      <ol className="flex items-center gap-2 text-xs font-medium text-muted-foreground" role="list">
        {STEP_LABELS.map((label, index) => {
          const current = step === index
          const completed = step > index
          return (
            <li key={label} className="flex flex-1 items-center gap-2" aria-current={current ? "step" : undefined}>
              <span
                className={`flex size-6 items-center justify-center rounded-full text-[11px] ${
                  completed
                    ? "bg-emerald-600 text-white"
                    : current
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-slate-100 text-slate-400"
                }`}
              >
                {index + 1}
              </span>
              <span className={current ? "text-emerald-700" : "text-muted-foreground"}>{label}</span>
              {index < STEP_LABELS.length - 1 && <div className="h-px flex-1 bg-slate-200" />}
            </li>
          )
        })}
      </ol>

      {step === 0 && (
        <div className="space-y-6">
          <div className="space-y-2">
            <label htmlFor="signup-name" className="text-sm font-medium text-gray-800">
              {"이름"}
            </label>
            <Input
              id="signup-name"
              ref={nameRef}
              value={form.name}
              onChange={(event) => updateForm("name", event.target.value)}
              placeholder="예: 김도미"
              autoComplete="name"
              className={inputStyle}
              aria-invalid={isIdentityStep && error ? true : undefined}
              aria-describedby={isIdentityStep && error ? errorMessageId : undefined}
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-2">
              <label htmlFor="signup-room" className="text-sm font-medium text-gray-800">
                {"호실 번호"}
              </label>
              <Input
                id="signup-room"
                value={form.roomNumber}
                onChange={(event) =>
                  updateForm("roomNumber", event.target.value.replace(/[^0-9]/g, "").slice(0, 3))
                }
                placeholder="예: 301"
                inputMode="numeric"
                className={inputStyle}
                aria-invalid={isIdentityStep && error ? true : undefined}
                aria-describedby={isIdentityStep && error ? errorMessageId : undefined}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="signup-personal" className="text-sm font-medium text-gray-800">
                {"개인 번호"}
              </label>
              <Input
                id="signup-personal"
                value={form.personalNo}
                onChange={(event) =>
                  updateForm("personalNo", event.target.value.replace(/[^1-3]/g, "").slice(0, 1))
                }
                placeholder="1~3"
                inputMode="numeric"
                className={inputStyle}
                aria-invalid={isIdentityStep && error ? true : undefined}
                aria-describedby={isIdentityStep && error ? errorMessageId : undefined}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            {"기숙사 호실 번호와 개인 번호는 사감실에서 배정된 정보를 기준으로 입력해 주세요."}
          </p>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-6">
          <div className="space-y-2">
            <label htmlFor="signup-loginId" className="text-sm font-medium text-gray-800">
              {"로그인 아이디"}
            </label>
            <Input
              id="signup-loginId"
              ref={loginIdRef}
              value={form.loginId}
              onChange={(event) => updateForm("loginId", event.target.value)}
              placeholder="영문 소문자/숫자 조합"
              autoComplete="username"
              className={inputStyle}
              aria-invalid={isAccountStep && error ? true : undefined}
              aria-describedby={isAccountStep && error ? errorMessageId : undefined}
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="signup-password" className="text-sm font-medium text-gray-800">
              {"비밀번호"}
            </label>
            <div className="relative">
              <Input
                id="signup-password"
                type={showPassword ? "text" : "password"}
                value={form.password}
                onChange={(event) => updateForm("password", event.target.value)}
                placeholder="영문/숫자 포함 6자 이상"
                autoComplete="new-password"
                className={inputStyle}
                aria-invalid={isAccountStep && error ? true : undefined}
                aria-describedby={isAccountStep && error ? errorMessageId : undefined}
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
          <div className="space-y-2">
            <label htmlFor="signup-confirm" className="text-sm font-medium text-gray-800">
              {"비밀번호 확인"}
            </label>
            <div className="relative">
              <Input
                id="signup-confirm"
                type={showConfirmPassword ? "text" : "password"}
                value={form.confirmPassword}
                onChange={(event) => updateForm("confirmPassword", event.target.value)}
                placeholder="비밀번호를 한번 더 입력해 주세요."
                autoComplete="new-password"
                className={inputStyle}
                aria-invalid={isAccountStep && error ? true : undefined}
                aria-describedby={isAccountStep && error ? errorMessageId : undefined}
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-500 transition hover:text-gray-700"
                aria-label={showConfirmPassword ? "비밀번호 숨기기" : "비밀번호 표시"}
                onClick={() => setShowConfirmPassword((prev) => !prev)}
              >
                {showConfirmPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-6">
          <div className="space-y-2">
            <label htmlFor="signup-email" className="text-sm font-medium text-gray-800">
              {"이메일 (선택)"}
            </label>
            <Input
              id="signup-email"
              value={form.email}
              onChange={(event) => updateForm("email", event.target.value)}
              placeholder="예: dormmate@example.com"
              autoComplete="email"
              className={inputStyle}
              aria-invalid={isContactStep && error ? true : undefined}
              aria-describedby={isContactStep && error ? errorMessageId : undefined}
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="signup-phone" className="text-sm font-medium text-gray-800">
              {"연락처 (선택)"}
            </label>
            <Input
              id="signup-phone"
              value={form.phone}
              onChange={(event) => updateForm("phone", event.target.value.replace(/[^0-9-]/g, ""))}
              placeholder="010-1234-5678"
              autoComplete="tel-national"
              className={inputStyle}
              aria-invalid={isContactStep && error ? true : undefined}
              aria-describedby={isContactStep && error ? errorMessageId : undefined}
            />
          </div>
          <div className="space-y-3 rounded-2xl bg-slate-50/80 px-4 py-3">
            <label className="text-xs font-medium text-slate-600">{"필수 동의"}</label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <Checkbox
                checked={form.agreeTerms}
                onCheckedChange={(checked) => updateForm("agreeTerms", Boolean(checked))}
                aria-describedby={isContactStep && error ? errorMessageId : undefined}
              />
              {"DormMate 이용약관에 동의합니다."}
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <Checkbox
                checked={form.agreePolicy}
                onCheckedChange={(checked) => updateForm("agreePolicy", Boolean(checked))}
                aria-describedby={isContactStep && error ? errorMessageId : undefined}
              />
              {"개인정보 처리방침에 동의합니다."}
            </label>
          </div>
        </div>
      )}

      <p
        id={errorMessageId}
        ref={errorRegionRef}
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
        tabIndex={error ? -1 : undefined}
        className={`min-h-[1.25rem] text-sm font-medium text-rose-600 ${error ? "" : "sr-only"}`}
      >
        {error ? error : " "}
      </p>

      <div className="flex items-center gap-3">
        {step > 0 && (
          <Button
            type="button"
            variant="outline"
            className="h-11 flex-1 rounded-xl"
            onClick={() => setStep((step - 1) as Step)}
          >
            {"이전"}
          </Button>
        )}
        {step < 2 ? (
          <Button
            type="submit"
            className="h-11 flex-1 rounded-xl bg-emerald-600 font-semibold shadow-lg shadow-emerald-600/20 transition hover:bg-emerald-700"
            onClick={handleNext}
            disabled={pending}
          >
            {"다음"}
          </Button>
        ) : (
          <Button
            type="submit"
            className="h-11 flex-1 rounded-xl bg-emerald-600 font-semibold shadow-lg shadow-emerald-600/20 transition hover:bg-emerald-700"
            onClick={handleRegister}
            disabled={pending}
          >
            {pending && <Loader2 className="mr-2 size-4 animate-spin" />}
            {"회원가입 완료"}
          </Button>
        )}
      </div>

      <button
        type="button"
        onClick={onSwitchToLogin}
        className="w-full text-center text-sm font-medium text-emerald-700 hover:underline"
      >
        {"이미 계정이 있으신가요? 로그인하기"}
      </button>
    </form>
  )
}

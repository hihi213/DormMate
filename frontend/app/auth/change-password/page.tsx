"use client"
import { useEffect, useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { changePassword, getCurrentUser, logout } from "@/lib/auth"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

export default function ChangePasswordPage() {
  const router = useRouter()
  const [current, setCurrent] = useState("")
  const [password, setPassword] = useState("")
  const [confirmation, setConfirmation] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  useEffect(() => { if (!getCurrentUser()) router.replace("/auth?mode=login") }, [router])
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (password !== confirmation) { setError("새 비밀번호가 서로 다릅니다."); return }
    if (password.length < 8 || new TextEncoder().encode(password).length > 72 || password === current) {
      setError("기존 비밀번호와 다른 8자 이상 비밀번호를 입력해 주세요. UTF-8 기준 최대 72바이트입니다."); return
    }
    setBusy(true); setError("")
    try { await changePassword(current, password); router.replace("/auth?mode=login&reason=passwordChanged") }
    catch (e) { setError(e instanceof Error ? e.message : "비밀번호를 변경하지 못했습니다.") }
    finally { setBusy(false) }
  }
  return <main className="mx-auto max-w-md p-6">
    <h1 className="text-2xl font-semibold">비밀번호 변경</h1>
    <p className="my-4 text-sm text-slate-600">최초 로그인 또는 관리자 초기화 후에는 비밀번호를 변경해야 시설을 이용할 수 있습니다. 초기 비밀번호는 0000입니다. 변경 후 다시 로그인해 주세요.</p>
    <form onSubmit={submit} className="space-y-4">
      <label className="block">현재 비밀번호<Input type="password" autoComplete="current-password" required value={current} onChange={e => setCurrent(e.target.value)} /></label>
      <label className="block">새 비밀번호<Input type="password" autoComplete="new-password" required minLength={8} value={password} onChange={e => setPassword(e.target.value)} /></label>
      <label className="block">새 비밀번호 확인<Input type="password" autoComplete="new-password" required value={confirmation} onChange={e => setConfirmation(e.target.value)} /></label>
      {error && <p role="alert" className="text-red-700">{error}</p>}
      <Button disabled={busy} type="submit">{busy ? "변경 중…" : "비밀번호 변경"}</Button>
      <Button type="button" variant="outline" disabled={busy} onClick={async () => { await logout(); router.replace("/auth") }}>로그아웃</Button>
    </form>
  </main>
}

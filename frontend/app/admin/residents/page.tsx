"use client"
import { useCallback, useEffect, useState, type FormEvent } from "react"
import Link from "next/link"
import { safeApiCall } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type Slot = { id: string; userId: string; loginId: string; roomNumber: string; personalNo: number; displayName: string; status: string; occupied: boolean; mustChangePassword: boolean }
type Action = "check-in" | "check-out" | "reset-password"
const labels: Record<Action,string> = { "check-in": "입사 처리", "check-out": "퇴사 처리", "reset-password": "비밀번호 초기화" }

export default function ResidentsPage() {
  const [slots,setSlots] = useState<Slot[]>([])
  const [query,setQuery] = useState("")
  const [selected,setSelected] = useState<{slot: Slot; action: Action} | null>(null)
  const [name,setName] = useState("")
  const [email,setEmail] = useState("")
  const [reason,setReason] = useState("")
  const [busy,setBusy] = useState(false)
  const [message,setMessage] = useState("")
  const [error,setError] = useState("")
  const load = useCallback(async () => {
    const result = await safeApiCall<Slot[]>("/admin/resident-slots")
    if (result.error) setError(result.error.message)
    else setSlots(result.data ?? [])
  }, [])
  useEffect(() => { void load() }, [load])
  function select(slot: Slot, action: Action) { setSelected({slot,action}); setName(""); setEmail(""); setReason(""); setError(""); setMessage("") }
  async function submit(event: FormEvent) {
    event.preventDefault(); if (!selected || busy) return
    setBusy(true); setError("")
    try {
      const {slot,action} = selected
      const result = await safeApiCall<void>(`/admin/resident-slots/${slot.id}/${action}`, {
        method: "POST", parseResponseAs: "none",
        body: action === "check-in" ? {name,email,reason} : {userId:slot.userId,reason},
      })
      if (result.error) { setError(result.error.message); return }
      setMessage(`${slot.loginId} ${labels[action]} 완료`); setSelected(null); await load()
    } finally { setBusy(false) }
  }
  return <main className="space-y-5 p-6">
    <h1 className="text-2xl font-semibold">입사·퇴사 및 비밀번호 관리</h1>
    <p>아이디는 호실-개인번호입니다. 입사 처리 후 0000으로 로그인하고 비밀번호를 변경해야 합니다. 퇴사 시 기존 이력은 보존하고 다음 입주자를 위한 비활성 계정을 준비합니다.</p>
    <Link href="/admin/users" className="text-emerald-700 underline">역할·사용자 관리</Link>
    <label className="block">호실·아이디·이름 검색<Input value={query} onChange={e=>setQuery(e.target.value)} /></label>
    {message && <p role="status">{message}</p>}{error && <p role="alert" className="text-red-700">{error}</p>}
    {selected && <form onSubmit={submit} className="space-y-3 rounded border p-4">
      <h2 className="font-semibold">{selected.slot.loginId} — {labels[selected.action]}</h2>
      {selected.action === "check-in" ? <>
        <label className="block">입주자 이름<Input required maxLength={100} value={name} onChange={e=>setName(e.target.value)} /></label>
        <label className="block">이메일 (선택)<Input type="email" maxLength={320} value={email} onChange={e=>setEmail(e.target.value)} /></label>
      </> : <p>{selected.action === "check-out" ? "현재 입주자의 로그인을 차단하고 입주 배정을 종료합니다." : "비밀번호를 0000으로 초기화하고 변경을 다시 요구합니다."} 기존 로그인 세션은 모두 폐기됩니다.</p>}
      <label className="block">처리 사유<Input required maxLength={500} value={reason} onChange={e=>setReason(e.target.value)} /></label>
      <Button type="submit" disabled={busy}>{busy ? "처리 중…" : `${labels[selected.action]} 확인`}</Button>{" "}
      <Button type="button" variant="outline" disabled={busy} onClick={()=>setSelected(null)}>취소</Button>
    </form>}
    <div className="overflow-x-auto"><table className="w-full text-left text-sm">
      <thead><tr><th className="p-2">아이디</th><th>입주자</th><th>상태</th><th>처리</th></tr></thead>
      <tbody>{slots.filter(s=>`${s.loginId} ${s.displayName}`.includes(query)).map(slot=><tr key={slot.id} className="border-t">
        <td className="p-2">{slot.loginId}</td><td>{slot.displayName}</td><td>{slot.occupied ? (slot.status === "ACTIVE" ? "입사" : "이용 중지") : "미입사"}{slot.occupied && slot.mustChangePassword ? " · 비밀번호 변경 필요" : ""}</td>
        <td className="space-x-2 py-2">{!slot.occupied ? <Button size="sm" disabled={busy} onClick={()=>select(slot,"check-in")}>입사</Button> : <>
          <Button size="sm" variant="outline" disabled={busy || slot.status !== "ACTIVE"} onClick={()=>select(slot,"reset-password")}>초기화</Button>
          <Button size="sm" variant="destructive" disabled={busy} onClick={()=>select(slot,"check-out")}>퇴사</Button>
        </>}</td>
      </tr>)}</tbody>
    </table></div>
  </main>
}

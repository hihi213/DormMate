"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { CalendarDays, ClipboardCheck, Loader2, PauseCircle, Play, ShieldCheck } from "lucide-react"

import BottomNav from "@/components/bottom-nav"
import AuthGuard from "@/features/auth/components/auth-guard"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { SlotSelector } from "@/features/fridge/components/slot-selector"
import { useToast } from "@/hooks/use-toast"
import { getCurrentUser } from "@/lib/auth"
import { formatShortDate } from "@/lib/date-utils"
import { formatCompartmentLabel } from "@/features/fridge/utils/labels"
import type { Slot } from "@/features/fridge/types"
import type { InspectionAction, InspectionSession } from "@/features/inspections/types"
import {
  cancelInspection,
  fetchActiveInspection,
  fetchInspectionSlots,
  startInspection,
} from "@/features/inspections/api"

export default function InspectionsPage() {
  return (
    <AuthGuard>
      <InspectionsInner />
      <BottomNav />
    </AuthGuard>
  )
}

function InspectionsInner() {
  const router = useRouter()
  const { toast } = useToast()
  const [slots, setSlots] = useState<Slot[]>([])
  const [activeSession, setActiveSession] = useState<InspectionSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)
  const [canceling, setCanceling] = useState(false)
  const [selectedSlotId, setSelectedSlotId] = useState<string>("")
  const [error, setError] = useState<string | null>(null)

  const currentUser = getCurrentUser()
  const canManage = currentUser?.roles.includes("FLOOR_MANAGER") || currentUser?.roles.includes("ADMIN")

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const [slotList, session] = await Promise.all([fetchInspectionSlots(), fetchActiveInspection()])
        setSlots(slotList.filter((slot) => slot.resourceStatus === "ACTIVE"))
        setActiveSession(session)
      } catch (err) {
        const message = err instanceof Error ? err.message : "검사 정보를 불러오지 못했습니다."
        setError(message)
        toast({
          title: "검사 정보 조회 실패",
          description: message,
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    }

    if (canManage) {
      void load()
    } else {
      setLoading(false)
    }
  }, [canManage, toast])

  const availableSlots = useMemo(() => {
    if (!slots.length) return []
    if (!activeSession) return slots
    return slots.filter((slot) => slot.slotId !== activeSession.slotId)
  }, [slots, activeSession])

  const selectedSlot = availableSlots.find((slot) => slot.slotId === selectedSlotId)

  const handleStartInspection = async () => {
    if (!selectedSlot || starting) return
    try {
      setStarting(true)
      const session = await startInspection({
        slotId: selectedSlot.slotId,
      })
      setActiveSession(session)
      toast({
        title: "검사를 시작했습니다.",
        description: `$\{formatCompartmentLabel(session.slotIndex)\} 칸 검사 세션이 생성되었습니다.`,
      })
      router.push(`/fridge/inspect?sessionId=${session.sessionId}`)
    } catch (err) {
      const message = err instanceof Error ? err.message : "검사를 시작하지 못했습니다."
      toast({
        title: "검사 시작 실패",
        description: message,
        variant: "destructive",
      })
    } finally {
      setStarting(false)
    }
  }

  const handleContinue = () => {
    if (!activeSession) return
    router.push(`/fridge/inspect?sessionId=${activeSession.sessionId}`)
  }

  const handleCancel = async () => {
    if (!activeSession || canceling) return
    if (!confirm("진행 중인 검사를 취소할까요? 기록되지 않은 내용은 모두 사라집니다.")) return

    try {
      setCanceling(true)
      await cancelInspection(activeSession.sessionId)
      setActiveSession(null)
      toast({
        title: "검사 세션이 취소되었습니다.",
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : "검사 취소에 실패했습니다."
      toast({
        title: "검사 취소 실패",
        description: message,
        variant: "destructive",
      })
    } finally {
      setCanceling(false)
    }
  }

  if (!canManage) {
    return (
      <main className="min-h-[100svh] bg-white">
        <div className="mx-auto max-w-screen-sm px-4 py-16 space-y-6 text-center">
          <ShieldCheck className="mx-auto h-12 w-12 text-emerald-600" />
          <h1 className="text-xl font-semibold text-gray-900">층별장 권한이 필요합니다.</h1>
          <p className="text-sm text-muted-foreground">
            이 화면은 층별장 또는 관리자만 접근할 수 있습니다. 권한이 없다면 메인 페이지로 이동해 주세요.
          </p>
          <Button onClick={() => router.replace("/")}>메인으로 이동</Button>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-[100svh] bg-white">
      <header className="sticky top-0 z-40 border-b bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="mx-auto max-w-screen-sm px-4 py-3 flex items-center justify-between">
          <div className="inline-flex items-center gap-2">
            <CalendarDays className="size-4 text-teal-700" />
            <h1 className="text-base font-semibold leading-none">{"냉장고 검사"}</h1>
          </div>
          {loading && <Loader2 className="size-4 animate-spin text-emerald-600" aria-hidden />}
        </div>
      </header>

      <div className="mx-auto max-w-screen-sm px-4 pb-28 pt-4 space-y-6">
        {error && (
          <Card className="border-rose-200">
            <CardContent className="py-4 text-sm text-rose-700">{error}</CardContent>
          </Card>
        )}

        {activeSession ? (
          <Card className="border-emerald-200">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <ClipboardCheck className="size-4 text-emerald-700" />
                {"진행 중인 검사"}
                <Badge variant="secondary" className="ml-auto">
                  {activeSession.status === "IN_PROGRESS" ? "진행 중" : "완료"}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-sm text-gray-800">
                <p className="font-semibold">{`${formatCompartmentLabel(activeSession.slotIndex)} 검사 세션`}</p>
                <p className="text-xs text-muted-foreground">
                  {`시작: ${formatShortDate(activeSession.startedAt)} (${new Date(activeSession.startedAt).toLocaleTimeString("ko-KR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })})`}
                </p>
                {activeSession.summary.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    {activeSession.summary.map((entry) => (
                      <span key={entry.action} className="inline-flex items-center gap-1 rounded-md border px-2 py-1">
                        {`${friendlyActionLabel(entry.action)} ${entry.count}건`}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={handleContinue}>
                  <Play className="mr-1 size-4" />
                  {"검사 계속"}
                </Button>
                <Button variant="outline" onClick={handleCancel} disabled={canceling}>
                  {canceling ? <Loader2 className="mr-1 size-4 animate-spin" /> : <PauseCircle className="mr-1 size-4" />}
                  {"검사 취소"}
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">{"진행 중인 검사 없음"}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {"현재 진행 중인 검사 세션이 없습니다. 아래에서 검사할 냉장고 칸을 선택해 새 세션을 시작하세요."}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">{"새 검사 시작"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <SlotSelector
              value={selectedSlotId}
              onChange={setSelectedSlotId}
              slots={availableSlots}
              placeholder={availableSlots.length ? "검사할 보관 칸 선택" : "검사 가능한 보관 칸이 없습니다"}
            />
            <Button
              onClick={handleStartInspection}
              disabled={!selectedSlot || starting}
              className="w-full sm:w-auto"
            >
              {starting ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Play className="mr-2 size-4" />}
              {"검사 시작"}
            </Button>
            <p className="text-xs text-muted-foreground">
              {"검사를 완료하면 자동으로 알림과 기록이 생성됩니다."}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">{"검사 이력"}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {"검사 이력은 관리자 대시보드에서 확인할 수 있습니다."}
          </CardContent>
        </Card>
      </div>
    </main>
  )
}

function friendlyActionLabel(action: InspectionAction): string {
  switch (action) {
    case "PASS":
      return "통과"
    case "DISPOSE_EXPIRED":
      return "폐기(유통)"
    case "UNREGISTERED_DISPOSE":
      return "폐기(미등록)"
    case "WARN_STORAGE_POOR":
      return "경고(보관)"
    case "WARN_INFO_MISMATCH":
      return "경고(정보)"
    default:
      return action
  }
}

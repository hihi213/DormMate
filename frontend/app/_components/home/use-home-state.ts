"use client"

import { useEffect, useMemo, useState } from "react"
import type { AuthUser } from "@/lib/auth"
import { fetchProfile, getCurrentUser, subscribeAuth } from "@/lib/auth"
import { fetchNextInspectionSchedule } from "@/features/inspections/api"
import { useLogoutRedirect } from "@/hooks/use-logout-redirect"

export type NextInspection = { dday: string; label: string } | null

function calcDday(target: Date) {
  const today = new Date(new Date().toDateString())
  const td = new Date(target.toDateString())
  const diff = Math.ceil((td.getTime() - today.getTime()) / 86400000)
  const isPast = diff < 0
  return {
    dday: isPast ? `D+${Math.abs(diff)}` : diff === 0 ? "D-DAY" : `D-${diff}`,
    label: isPast ? `D+${Math.abs(diff)}` : diff === 0 ? "D-day" : `D-${diff}`,
  }
}

function fmtMonthDay(d: Date) {
  return `${d.getMonth() + 1}월 ${d.getDate()}일`
}

export function useHomeState() {
  const [mounted, setMounted] = useState(false)
  const [user, setUser] = useState<AuthUser | null>(null)
  const isLoggedIn = useMemo(() => !!user, [user])
  const isAdmin = user?.isAdmin ?? false

  const [infoOpen, setInfoOpen] = useState(false)
  const [nextInspection, setNextInspection] = useState<NextInspection>(null)

  useEffect(() => {
    setMounted(true)
    setUser(getCurrentUser())
    const unsubscribe = subscribeAuth((current) => setUser(current))
    return () => unsubscribe()
  }, [])

  useEffect(() => {
    if (!mounted || !isLoggedIn) return
    void fetchProfile()
  }, [mounted, isLoggedIn])

  useEffect(() => {
    if (!mounted || !isLoggedIn) {
      setNextInspection(null)
      return
    }

    let cancelled = false
    const loadNextInspection = async () => {
      try {
        const schedule = await fetchNextInspectionSchedule()
        if (cancelled) return
        if (!schedule) {
          setNextInspection({ dday: "-", label: "예정 없음" })
          return
        }
        const target = new Date(schedule.scheduledAt)
        const { dday } = calcDday(target)
        setNextInspection({
          dday,
          label: `${fmtMonthDay(target)} (${dday})`,
        })
      } catch {
        if (!cancelled) {
          setNextInspection({ dday: "-", label: "예정 없음" })
        }
      }
    }
    void loadNextInspection()
    return () => {
      cancelled = true
    }
  }, [mounted, isLoggedIn])

  const logout = useLogoutRedirect()

  return {
    mounted,
    user,
    isLoggedIn,
    isAdmin,
    infoOpen,
    setInfoOpen,
    nextInspection,
    logout,
  }
}

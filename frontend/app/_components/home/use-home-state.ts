"use client"

import { useEffect, useMemo, useState } from "react"
import type { AuthUser } from "@/lib/auth"
import {
  DEMO_ACCOUNTS,
  fetchProfile,
  getCurrentUser,
  loginWithCredentials,
  logout as doLogout,
  subscribeAuth,
} from "@/lib/auth"

const SCHED_KEY = "fridge-inspections-schedule-v1"

type Schedule = {
  id: string
  dateISO: string
  title?: string
  notes?: string
}

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

  const [infoOpen, setInfoOpen] = useState(false)
  const [nextInspection, setNextInspection] = useState<NextInspection>(null)

  useEffect(() => {
    setMounted(true)
    setUser(getCurrentUser())
    const unsubscribe = subscribeAuth((current) => setUser(current))
    return () => unsubscribe()
  }, [])

  useEffect(() => {
    if (!mounted) return
    void fetchProfile()
  }, [mounted])

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(SCHED_KEY) || "null") as Schedule[] | null
      if (Array.isArray(saved) && saved.length) {
        const now = new Date()
        const upcoming = saved
          .map((s) => ({ ...s, d: new Date(s.dateISO) }))
          .filter((s) => s.d.getTime() >= now.getTime())
          .sort((a, b) => a.d.getTime() - b.d.getTime())[0]
        if (upcoming) {
          const d = calcDday(upcoming.d)
          setNextInspection({
            dday: d.dday,
            label: `${fmtMonthDay(upcoming.d)} (${d.dday})`,
          })
        } else {
          setNextInspection({ dday: "-", label: "예정 없음" })
        }
      } else {
        setNextInspection({ dday: "-", label: "예정 없음" })
      }
    } catch {
      setNextInspection({ dday: "-", label: "예정 없음" })
    }
  }, [])

  const logout = async () => {
    await doLogout()
  }

  const resetDemoForUser = async () => {
    await doLogout()
    if (typeof window !== "undefined") window.location.reload()
  }

  const startDemoWithDefaultUser = async () => {
    try {
      const demoAccount = DEMO_ACCOUNTS.find((account) => account.id === "alice") ?? DEMO_ACCOUNTS[0]
      if (!demoAccount) {
        throw new Error("데모 계정을 찾을 수 없습니다.")
      }
      await loginWithCredentials({ id: demoAccount.id, password: demoAccount.password })
      if (typeof window !== "undefined") window.location.reload()
    } catch (error) {
      console.error("demo login failed", error)
    }
  }

  return {
    mounted,
    user,
    isLoggedIn,
    infoOpen,
    setInfoOpen,
    nextInspection,
    logout,
    resetDemoForUser,
    startDemoWithDefaultUser,
  }
}

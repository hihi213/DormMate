"use client"

import { useEffect } from "react"
import { ensureValidAccessToken } from "@/lib/auth"

const HEARTBEAT_INTERVAL_MS = 30_000

export default function SessionHeartbeat() {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null
    let cancelled = false

    const tick = async () => {
      await ensureValidAccessToken()
      if (cancelled) return
      timer = setTimeout(tick, HEARTBEAT_INTERVAL_MS)
    }

    timer = setTimeout(tick, HEARTBEAT_INTERVAL_MS)

    return () => {
      cancelled = true
      if (timer) {
        clearTimeout(timer)
      }
    }
  }, [])

  return null
}

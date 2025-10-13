"use client"

import { useEffect } from "react"

export function useServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof window === "undefined") return
    if (!("serviceWorker" in navigator)) return

    const candidates: Array<{ url: string; opts?: RegistrationOptions }> = [
      { url: "/sw.js", opts: { scope: "/" } },
      { url: new URL("sw.js", window.location.href).toString() },
    ]

    let cancelled = false

    ;(async () => {
      for (const candidate of candidates) {
        if (cancelled) break
        try {
          await navigator.serviceWorker.register(candidate.url, candidate.opts)
          break
        } catch {
          // try next candidate
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])
}

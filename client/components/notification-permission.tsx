"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Bell } from "lucide-react"

export default function NotificationPermission() {
  const [supported, setSupported] = useState(false)
  const [status, setStatus] = useState<NotificationPermission>("default")

  useEffect(() => {
    const ok = typeof window !== "undefined" && "Notification" in window
    setSupported(ok)
    if (ok) setStatus(Notification.permission)
  }, [])

  if (!supported || status === "granted") {
    return (
      <Button
        variant="outline"
        size="icon"
        className="rounded-full bg-transparent"
        aria-label="Notifications enabled"
        disabled={status === "granted"}
      >
        <Bell className="size-4" />
      </Button>
    )
  }

  return (
    <Button
      variant="default"
      size="icon"
      className="rounded-full bg-emerald-600 hover:bg-emerald-700"
      aria-label="Enable notifications"
      onClick={async () => {
        try {
          const perm = await Notification.requestPermission()
          setStatus(perm)
          // Show a welcome notification if service worker is ready
          if (perm === "granted" && "serviceWorker" in navigator) {
            const reg = await navigator.serviceWorker.getRegistration()
            reg?.showNotification("알림이 활성화되었습니다", { body: "중요한 공지와 예약/타이머 알림을 받아보세요." })
          }
        } catch {
          // ignore
        }
      }}
    >
      <Bell className="size-4" />
    </Button>
  )
}

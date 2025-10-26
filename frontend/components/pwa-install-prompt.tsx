"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Download } from "lucide-react"

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>
}

export default function PWAInstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
    }
    window.addEventListener("beforeinstallprompt", handler as EventListener)
    return () => window.removeEventListener("beforeinstallprompt", handler as EventListener)
  }, [])

  if (!deferred || dismissed) return null

  return (
    <Card className="p-3 border-emerald-100 bg-emerald-50">
      <div className="flex items-center gap-3">
        <div className="size-8 rounded-md bg-emerald-600 text-white grid place-items-center" aria-hidden="true">
          <Download className="size-4" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium">{"홈 화면에 설치"}</p>
          <p className="text-xs text-emerald-900/80">{"빠르게 접근하고 오프라인에서도 사용하세요."}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            className="bg-white"
            onClick={() => setDismissed(true)}
            aria-label="Later"
          >
            {"나중에"}
          </Button>
          <Button
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-700"
            onClick={async () => {
              try {
                await deferred.prompt()
                setDeferred(null)
              } catch {
                setDeferred(null)
              }
            }}
            aria-label="Install app"
          >
            {"설치"}
          </Button>
        </div>
      </div>
    </Card>
  )
}

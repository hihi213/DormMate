"use client"

import { Dialog, DialogContent, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Copy, Check, X } from "lucide-react"
import { useState } from "react"

export default function RegistrationCompleteDialog({
  open = false,
  onOpenChange = () => {},
  code = "",
  qty = 1,
  isBundle = false,
}: {
  open?: boolean
  onOpenChange?: (v: boolean) => void
  code?: string
  qty?: number
  isBundle?: boolean
}) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    } catch {
      // ignore
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 overflow-x-hidden [&>button.absolute.right-4.top-4]:hidden [&_button[aria-label='Close']]:hidden [&_[aria-label='Close']]:hidden [&_button[title='Close']]:hidden">
        <DialogDescription className="sr-only">
          {"등록이 완료되었습니다. 식별번호를 확인하고 복사할 수 있습니다."}
        </DialogDescription>

        {/* Unified header with left-top X */}
        <div className="px-3 py-2 flex items-center justify-between gap-2 border-b">
          <Button variant="ghost" size="icon" aria-label="닫기" onClick={() => onOpenChange(false)}>
            <X className="w-5 h-5" />
          </Button>
          <div className="text-sm font-semibold">{"등록 완료"}</div>
          <span className="w-9" aria-hidden="true" />
        </div>

        <div className="p-3 space-y-3">
          <p className="text-sm text-muted-foreground">
            {isBundle
              ? `묶음이 대표 식별번호를 부여받았습니다. 스티커에 번호를 적어 묶음에 부착 후 보관해 주세요. (총 ${qty}개)`
              : "아래 식별번호를 스티커에 적어 제품에 부착 후 보관해 주세요."}
          </p>

          <div className="flex flex-wrap items-center gap-2 rounded-md border p-3 bg-gray-50">
            <code className="font-mono text-base sm:text-lg tracking-wider break-all">{code || "-"}</code>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopy}
              aria-label="식별번호 복사"
              className="shrink-0 bg-transparent"
            >
              {copied ? <Check className="size-4 mr-1" /> : <Copy className="size-4 mr-1" />}
              {copied ? "복사됨" : "복사"}
            </Button>
          </div>

          <div className="flex justify-end">
            <Button onClick={() => onOpenChange(false)} className="bg-emerald-600 hover:bg-emerald-700">
              {"확인"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

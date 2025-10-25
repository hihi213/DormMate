"use client"

import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogDescription } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { X } from "lucide-react"
import { ExpiryInput } from "@/components/shared/expiry-input"
import { toYMD } from "@/lib/date-utils"

export type DetailRow = { name: string; expiry: string }

export default function DetailsEditorDialog({
  open = false,
  onOpenChange = () => {},
  qty = 1,
  baseName = "",
  baseExpiry = "",
  initial = [],
  onSave = () => {},
}: {
  open?: boolean
  onOpenChange?: (v: boolean) => void
  qty?: number
  baseName?: string
  baseExpiry?: string
  initial?: DetailRow[]
  onSave?: (rows: DetailRow[]) => void
}) {
  const [rows, setRows] = useState<DetailRow[]>([])

  useEffect(() => {
    if (!open) return
    const today = toYMD(new Date())
    const next: DetailRow[] = []
    for (let i = 0; i < Math.max(1, qty); i++) {
      const existing = initial[i]
      next[i] = existing ?? { name: baseName ? `${baseName} ${i + 1}` : "", expiry: baseExpiry || today }
    }
    setRows(next)
  }, [open, qty, baseName, baseExpiry, initial])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg p-0 overflow-x-hidden [&>button.absolute.right-4.top-4]:hidden [&_button[aria-label='Close']]:hidden [&_[aria-label='Close']]:hidden [&_button[title='Close']]:hidden">
        <DialogDescription className="sr-only">
          {"묶음 세부 물품의 이름과 유통기한을 수정하는 대화상자입니다."}
        </DialogDescription>

        {/* Unified header with left-top X */}
        <div className="px-3 py-2 flex items-center justify-between gap-2 border-b">
          <Button variant="ghost" size="icon" aria-label="닫기" onClick={() => onOpenChange(false)}>
            <X className="w-5 h-5" />
          </Button>
          <div className="text-sm font-semibold">{`세부물품 수정 (${qty}개)`}</div>
          <span className="w-9" aria-hidden="true" />
        </div>

        <div className="p-3">
          <div className="rounded-md border">
            <div className="px-3 py-2 border-b text-xs text-muted-foreground">
              {"각 항목의 이름과 유통기한을 수정하세요. (오늘 기준 남은일 자동 표시)"}
            </div>
            <div className="max-h-72 overflow-y-auto p-3 space-y-3">
              {rows.map((row, idx) => {
                return (
                  <div key={idx} className="grid grid-cols-1 sm:grid-cols-2 gap-2 items-end">
                    <div className="min-w-0">
                      <Label className="text-xs">{`세부명 #${idx + 1}`}</Label>
                      <input value={row.name}
                        onChange={(e) =>
                          setRows((r) => {
                            const n = [...r]
                            n[idx] = { ...n[idx], name: e.target.value }
                            return n
                          })
                        }
                        placeholder={baseName ? `${baseName} ${idx + 1}` : `예: 항목 ${idx + 1}`}
                        className="min-w-0"
                      />
                    </div>
                    <ExpiryInput
                      id={`detail-expiry-${idx}`}
                      label="유통기한"
                      value={row.expiry}
                      onChange={(next) =>
                        setRows((r) => {
                          const n = [...r]
                          n[idx] = { ...n[idx], expiry: next }
                          return n
                        })
                      }
                      presets={[]}
                      warningThresholdDays={3}
                      helperText="개별 유통기한을 설정하세요."
                    />
                  </div>
                )
              })}
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-3">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {"취소"}
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={() => {
                onSave(rows)
                onOpenChange(false)
              }}
            >
              {"수정 완료"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

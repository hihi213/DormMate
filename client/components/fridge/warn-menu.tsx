"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { AlertTriangle, ChevronDown } from "lucide-react"

export default function WarnMenu({
  onSelect = () => {},
}: {
  onSelect?: (kind: "warn_storage" | "warn_mismatch") => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          <AlertTriangle className="size-4 mr-1 text-amber-600" />
          {"조치"}
          <ChevronDown className="size-4 ml-1" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 p-1">
        <button
          className="w-full text-left rounded-md px-2 py-1.5 text-sm hover:bg-gray-50"
          onClick={() => {
            onSelect("warn_storage")
            setOpen(false)
          }}
        >
          {"보관상태 불량 (경고)"}
        </button>
        <button
          className="w-full text-left rounded-md px-2 py-1.5 text-sm hover:bg-gray-50"
          onClick={() => {
            onSelect("warn_mismatch")
            setOpen(false)
          }}
        >
          {"정보 불일치 (경고)"}
        </button>
      </PopoverContent>
    </Popover>
  )
}

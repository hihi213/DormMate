"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { AlertTriangle, ChevronDown } from "lucide-react"

export default function WarnMenu({
  onSelect = () => {},
}: {
  onSelect?: (kind: "warn_storage" | "warn_mismatch") => void
}) {
  const [open, setOpen] = useState(false)

  const handleSelect = (kind: "warn_storage" | "warn_mismatch") => {
    onSelect(kind)
    setOpen(false)
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen} modal={false}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <AlertTriangle className="size-4 mr-1 text-amber-600" />
          {"조치"}
          <ChevronDown className="size-4 ml-1" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56" sideOffset={6}>
        <DropdownMenuItem className="text-sm" onSelect={() => handleSelect("warn_storage")}>
          {"보관상태 불량 (경고)"}
        </DropdownMenuItem>
        <DropdownMenuItem className="text-sm" onSelect={() => handleSelect("warn_mismatch")}>
          {"정보 불일치 (경고)"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

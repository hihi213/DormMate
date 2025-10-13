"use client"

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
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <AlertTriangle className="size-4 mr-1 text-amber-600" />
          {"조치"}
          <ChevronDown className="size-4 ml-1" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem className="text-sm" onSelect={() => onSelect("warn_storage")}>
          {"보관상태 불량 (경고)"}
        </DropdownMenuItem>
        <DropdownMenuItem className="text-sm" onSelect={() => onSelect("warn_mismatch")}>
          {"정보 불일치 (경고)"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

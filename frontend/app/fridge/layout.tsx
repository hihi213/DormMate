"use client"

import type { ReactNode } from "react"
import { FridgeProvider } from "@/features/fridge/hooks/fridge-context"

export default function FridgeLayout({ children }: { children: ReactNode }) {
  return <FridgeProvider>{children}</FridgeProvider>
}

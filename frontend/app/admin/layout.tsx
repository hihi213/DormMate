import type { ReactNode } from "react"

import AuthGuard from "@/features/auth/components/auth-guard"
import { AdminShell } from "@/components/admin"

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGuard>
      <AdminShell>{children}</AdminShell>
    </AuthGuard>
  )
}

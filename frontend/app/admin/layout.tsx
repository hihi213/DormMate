import type { ReactNode } from "react"

import AuthGuard from "@/features/auth/components/auth-guard"
import AdminGuard from "@/features/auth/components/admin-guard"
import { AdminShell } from "@/components/admin"

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGuard>
      <AdminGuard>
        <AdminShell>{children}</AdminShell>
      </AdminGuard>
    </AuthGuard>
  )
}

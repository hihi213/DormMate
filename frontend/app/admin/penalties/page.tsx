import { redirect } from "next/navigation"

export default function AdminPenaltiesPage() {
  redirect("/admin/users#penalty-summary")
}

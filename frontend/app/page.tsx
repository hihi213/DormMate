import { cookies } from "next/headers"
import { redirect } from "next/navigation"

import HomePageClient from "./home-client"

export default function HomePage() {
  const cookieStore = cookies()
  const isAdmin = cookieStore.get("dm.admin")?.value === "1"

  if (isAdmin) {
    redirect("/admin")
  }

  return <HomePageClient />
}

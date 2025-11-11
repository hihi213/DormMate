import { cookies } from "next/headers"
import { redirect } from "next/navigation"

import HomePageClient from "./home-client"

export default async function HomePage() {
  const cookieStore = await cookies()
  const isAdmin = cookieStore.get("dm.admin")?.value === "1"

  if (isAdmin) {
    redirect("/admin")
  }

  return <HomePageClient />
}

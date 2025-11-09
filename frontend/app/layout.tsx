import type { ReactNode } from "react"
import type { Metadata } from "next"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import "./globals.css"
import { Toaster } from "@/components/ui/toaster"
import SessionHeartbeat from "@/app/_components/session-heartbeat"

export const metadata: Metadata = {
  title: "DormMate",
  description: "Dormitory fridge management for residents and admins",
  generator: "DormMate",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode
}>) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className={GeistSans.className}>
        <SessionHeartbeat />
        {children}
        <Toaster />
      </body>
    </html>
  )
}

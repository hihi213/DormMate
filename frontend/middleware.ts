import { NextResponse, type NextRequest } from "next/server"
import { isFixtureMode } from "@/lib/fixture-mode"

export function middleware(_request: NextRequest) {
  if (!isFixtureMode()) {
    return NextResponse.json({ code: "NOT_FOUND" }, { status: 404 })
  }
  return NextResponse.next()
}

export const config = { matcher: "/api/__fixtures__/:path*" }

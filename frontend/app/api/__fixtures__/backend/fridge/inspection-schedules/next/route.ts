import { NextResponse } from "next/server"
import { buildInspectionSchedules } from "../../../_lib/fixture-auth"

export async function GET() {
  const schedules = buildInspectionSchedules()
  const next = schedules[0] ?? null
  if (!next) {
    return new NextResponse(null, { status: 204 })
  }
  return NextResponse.json(next)
}

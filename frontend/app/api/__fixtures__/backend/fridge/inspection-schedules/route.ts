import { NextResponse } from "next/server"
import { buildInspectionSchedules, resolveFixtureRole } from "../../_lib/fixture-auth"

export async function GET(request: Request) {
  const role = resolveFixtureRole(request)
  if (role !== "floorManager") {
    // 거주자/관리자에게는 빈 목록만 제공한다.
    return NextResponse.json([])
  }
  return NextResponse.json(buildInspectionSchedules())
}

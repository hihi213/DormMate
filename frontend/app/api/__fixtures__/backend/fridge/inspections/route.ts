import { NextResponse } from "next/server"
import { buildInspectionHistoryFixture } from "../../_lib/fixture-auth"

export async function GET() {
  return NextResponse.json(buildInspectionHistoryFixture())
}

import { NextResponse } from "next/server"
import { buildFridgeSlotList } from "../../_lib/fixture-auth"

export async function GET() {
  return NextResponse.json(buildFridgeSlotList())
}

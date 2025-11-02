import { NextResponse } from "next/server"
import { buildUserProfile, resolveFixtureRole } from "../../_lib/fixture-auth"

export async function GET(request: Request) {
  const role = resolveFixtureRole(request)
  const profile = buildUserProfile(role)
  return NextResponse.json(profile)
}

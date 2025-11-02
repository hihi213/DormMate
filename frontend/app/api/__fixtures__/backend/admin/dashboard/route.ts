import { ensureRole, buildAdminDashboardFixture, resolveFixtureRole } from "../../_lib/fixture-auth"

export async function GET(request: Request) {
  const role = resolveFixtureRole(request)
  return ensureRole(role, ["admin"], buildAdminDashboardFixture())
}

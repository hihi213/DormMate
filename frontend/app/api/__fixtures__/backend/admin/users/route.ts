import { ensureRole, resolveFixtureRole } from "../../_lib/fixture-auth"

export async function GET(request: Request) {
  const role = resolveFixtureRole(request)
  return ensureRole(role, ["admin"], {
    items: [
      {
        userId: "fixture-resident",
        name: "거주자 테스트",
        room: "201호",
        penaltyPoints: 0,
        bundles: 2,
        lastInspection: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        userId: "fixture-floor-manager",
        name: "층별장 테스트",
        room: "관리자실",
        penaltyPoints: 1,
        bundles: 0,
        lastInspection: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ],
  })
}

import { ensureRole, resolveFixtureRole } from "../../_lib/fixture-auth"

export async function GET(request: Request) {
  const role = resolveFixtureRole(request)
  return ensureRole(role, ["admin"], {
    notification: {
      batchTime: "09:00",
      dailyLimit: 20,
      ttlHours: 24,
    },
    penalty: {
      limit: 10,
      template: "DormMate 벌점 누적 {점수}점으로 운영 권한이 7일간 제한됩니다.",
    },
  })
}

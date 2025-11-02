import { ensureRole, resolveFixtureRole } from "../../_lib/fixture-auth"

export async function GET(request: Request) {
  const role = resolveFixtureRole(request)
  return ensureRole(role, ["admin"], {
    items: [
      {
        id: "fridge-compartment-a",
        name: "냉장고 A칸",
        status: "ACTIVE",
        capacity: 24,
        occupied: 12,
        locked: false,
        floor: 2,
      },
    ],
  })
}

import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const status = searchParams.get("status")
  const response = {
    items: [],
    totalCount: 0,
    status: status ?? "active",
  }
  return NextResponse.json(response)
}

export async function POST() {
  return NextResponse.json(
    {
      message: "Fixture 모드에서는 포장 등록이 비활성화되어 있습니다.",
      code: "FIXTURE_DISABLED",
    },
    { status: 501 },
  )
}

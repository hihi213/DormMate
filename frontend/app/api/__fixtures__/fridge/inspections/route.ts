import { NextResponse } from "next/server"
import { buildInspectionSchedules } from "../../backend/_lib/fixture-auth"

const slotId = "00000000-0000-0000-0000-00000000a001"
const cancelNote = "자동화 테스트용 취소 세션 메모"

const slotListResponse = {
  items: [
    {
      slotId,
      slotIndex: 0,
      slotLetter: "A",
      floorNo: 2,
      floorCode: "2F",
      compartmentType: "CHILL",
      resourceStatus: "ACTIVE",
      locked: false,
      lockedUntil: null,
      capacity: 24,
      displayName: "2층 냉장 A",
      occupiedCount: 0,
    },
  ],
  totalCount: 1,
}

const canceledSessionDto = {
  sessionId: "10000000-0000-0000-0000-000000000001",
  slotId,
  slotIndex: 0,
  slotLabel: "A",
  floorNo: 2,
  floorCode: "2F",
  status: "CANCELLED",
  startedBy: "20000000-0000-0000-0000-000000000002",
  startedAt: "2024-10-01T09:00:00Z",
  endedAt: "2024-10-01T09:15:00Z",
  bundles: [],
  summary: [
    {
      action: "PASS",
      count: 1,
    },
  ],
  actions: [],
  notes: cancelNote,
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const resource = searchParams.get("resource")

  switch (resource) {
    case "slots":
      return NextResponse.json(slotListResponse)
    case "active":
      return new NextResponse(null, { status: 204 })
    case "schedules":
      return NextResponse.json(buildInspectionSchedules())
    case "history":
    default:
      return NextResponse.json([canceledSessionDto])
  }
}

import { NextResponse } from "next/server"

const slotId = "00000000-0000-0000-0000-00000000a001"
const cancelNote = "자동화 테스트용 취소 세션 메모"

const canceledSession = {
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

export async function GET() {
  return NextResponse.json([canceledSession])
}

import { NextResponse } from "next/server"

const slotId = "00000000-0000-0000-0000-00000000a001"

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

export async function GET() {
  return NextResponse.json(slotListResponse)
}

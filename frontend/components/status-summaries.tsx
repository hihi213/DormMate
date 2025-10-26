"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Users, AlertTriangle, ListOrdered, ShieldCheck, DoorOpen, BookOpen, Snowflake, Shirt } from "lucide-react"

export default function StatusSummaries() {
  // Static demo data for the main page; wire to API later
  const fridge = { expiringSoon: 2, myItems: 5, inspectionsToday: 1 }
  const laundry = { available: 3, inUse: 5, nextFreeInMin: 12 }
  const study = { freeNow: 2, reservationsThisWeek: 8 }
  const books = { myLoans: 2, dueSoon: 1 }
  const user = { points: +2, penalties: 1, warningsThisMonth: 0 }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Snowflake className="size-4 text-emerald-700" />
            {"냉장고 요약"}
            {fridge.expiringSoon > 0 && (
              <Badge variant="secondary" className="ml-auto">{`임박 ${fridge.expiringSoon}`}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <div className="flex items-center justify-between">
            <span>
              {"내 물품"} <b className="text-gray-900">{fridge.myItems}</b>
            </span>
            <span>
              {"점검 예정"} <b className="text-gray-900">{fridge.inspectionsToday}</b>
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Shirt className="size-4 text-emerald-700" />
            {"세탁 현황"}
            <Badge variant="secondary" className="ml-auto">{`대기 ${laundry.available}`}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <div className="flex items-center justify-between">
            <span>
              {"사용 중"} <b className="text-gray-900">{laundry.inUse}</b>
            </span>
            <span>
              {"다음 빈 기기"} <b className="text-gray-900">{`${laundry.nextFreeInMin}분`}</b>
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <DoorOpen className="size-4 text-emerald-700" />
            {"스터디룸"}
            <Badge variant="secondary" className="ml-auto">{`지금 가능 ${study.freeNow}`}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <div className="flex items-center justify-between">
            <span>
              {"이번주 예약"} <b className="text-gray-900">{study.reservationsThisWeek}</b>
            </span>
            <span className="text-xs">{"월요일 오픈"}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <BookOpen className="size-4 text-emerald-700" />
            {"도서 현황"}
            <Badge variant="secondary" className="ml-auto">{`반납 임박 ${books.dueSoon}`}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <div className="flex items-center justify-between">
            <span>
              {"내 대출"} <b className="text-gray-900">{books.myLoans}</b>
            </span>
            <span className="text-xs">{"연장 가능"}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Users className="size-4 text-emerald-700" />
            {"내 이용/상벌점"}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <ShieldCheck className="size-4 text-emerald-700" />
              {"상점"} <b className="text-gray-900">{user.points}</b>
            </span>
            <span className="inline-flex items-center gap-1">
              <AlertTriangle className="size-4 text-amber-600" />
              {"벌점"} <b className="text-gray-900">{user.penalties}</b>
            </span>
            <span className="inline-flex items-center gap-1">
              <ListOrdered className="size-4 text-gray-500" />
              {"경고"} <b className="text-gray-900">{user.warningsThisMonth}</b>
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

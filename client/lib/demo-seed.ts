import { getCurrentUserId, setCurrentUser } from "./auth"

const STORAGE_KEY = "fridge-items-v1"
const INSPECT_KEY = "fridge-inspection-v1"
const SLOTS_KEY = "fridge-slots-v1"
const HIST_KEY = "fridge-inspections-history-v1"
const SCHED_KEY = "fridge-inspections-schedule-v1"

type Slot = { code: string; label: string }
type Item = {
  id: string
  slotCode: string
  label: string
  name: string
  expiry: string
  memo?: string
  owner: "me" | "other"
  ownerId?: string
  bundleId?: string
  groupCode?: string
  createdAt: number
  updatedAt: number
}

function initialSlots(): Slot[] {
  return [
    { code: "A1", label: "1층 과일칸" },
    { code: "A2", label: "1층 반찬칸" },
    { code: "A3", label: "1층 우유칸" },
    { code: "B1", label: "2층 냉동칸" },
    { code: "B2", label: "2층 공용칸" },
    { code: "B3", label: "2층 음료칸" },
    { code: "C1", label: "3층 특수보관칸" },
  ]
}

function todayPlus(days = 0) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

export function resetAndSeedAll(forceUserId?: string) {
  // Pick or set current user if missing
  const currentUserId = forceUserId || getCurrentUserId() || "1"
  if (!forceUserId && !getCurrentUserId()) {
    setCurrentUser(currentUserId)
  }

  // Clear known keys
  const KEYS = [
    STORAGE_KEY,
    INSPECT_KEY,
    SLOTS_KEY,
    HIST_KEY,
    SCHED_KEY,
    "laundry-messages",
    "my-laundry-end",
    "my-laundry-total-sec",
    "my-laundry-device",
    "library-my-loans",
  ]
  KEYS.forEach((k) => localStorage.removeItem(k))

  // Slots
  const slots = initialSlots()
  localStorage.setItem(SLOTS_KEY, JSON.stringify(slots))

  const labelOf = (code: string) => slots.find((s) => s.code === code)?.label || code

  const now = Date.now()
  const items: Item[] = []
  
  // Seed for each user: singles, bundles, expired/expiring/ok, with memos
  ;(["1", "2", "3"] as const).forEach((uid, idx) => {
    const isCurrent = uid === currentUserId
    const ownerFlag: "me" | "other" = isCurrent ? "me" : "other"

    // === 1층 과일칸 (A1) - 다양한 과일들 ===
    items.push({
      id: `A1${String(1 + idx).padStart(3, "0")}`,
      slotCode: "A1",
      label: labelOf("A1"),
      name: `사과 ${idx + 1}`,
      expiry: todayPlus(1), // expiring soon
      memo: isCurrent ? "내 사과 - 유통기한 확인" : "메모",
      owner: ownerFlag,
      ownerId: uid,
      createdAt: now - 86400000 * (2 + idx),
      updatedAt: now - 86400000 * (2 + idx),
    })
    
    items.push({
      id: `A1${String(10 + idx).padStart(3, "0")}`,
      slotCode: "A1",
      label: labelOf("A1"),
      name: `바나나 ${idx + 1}`,
      expiry: todayPlus(-1), // expired
      memo: isCurrent ? "검은 반점 생김 - 폐기 필요" : "메모",
      owner: ownerFlag,
      ownerId: uid,
      createdAt: now - 86400000 * (4 + idx),
      updatedAt: now - 86400000 * (2 + idx),
    })

    items.push({
      id: `A1${String(20 + idx).padStart(3, "0")}`,
      slotCode: "A1",
      label: labelOf("A1"),
      name: `오렌지 ${idx + 1}`,
      expiry: todayPlus(7), // good condition
      memo: isCurrent ? "신선함 유지" : "메모",
      owner: ownerFlag,
      ownerId: uid,
      createdAt: now - 86400000 * (1 + idx),
      updatedAt: now - 86400000 * (1 + idx),
    })

    // === 1층 반찬칸 (A2) - 반찬류 ===
    items.push({
      id: `A2${String(10 + idx).padStart(3, "0")}`,
      slotCode: "A2",
      label: labelOf("A2"),
      name: `두부 ${idx + 1}`,
      expiry: todayPlus(-1), // expired
      memo: isCurrent ? "먹지 마세요 - 유통기한 만료" : "메모",
      owner: ownerFlag,
      ownerId: uid,
      createdAt: now - 86400000 * (4 + idx),
      updatedAt: now - 86400000 * (2 + idx),
    })

    items.push({
      id: `A2${String(20 + idx).padStart(3, "0")}`,
      slotCode: "A2",
      label: labelOf("A2"),
      name: `김치 ${idx + 1}`,
      expiry: todayPlus(14), // good condition
      memo: isCurrent ? "냉장 보관 필수" : "메모",
      owner: ownerFlag,
      ownerId: uid,
      createdAt: now - 86400000 * (3 + idx),
      updatedAt: now - 86400000 * (3 + idx),
    })

    items.push({
      id: `A2${String(30 + idx).padStart(3, "0")}`,
      slotCode: "A2",
      label: labelOf("A2"),
      name: `계란 ${idx + 1}`,
      expiry: todayPlus(3), // expiring soon
      memo: isCurrent ? "빨리 먹어야 함" : "메모",
      owner: ownerFlag,
      ownerId: uid,
      createdAt: now - 86400000 * (5 + idx),
      updatedAt: now - 86400000 * (5 + idx),
    })

    // === 1층 우유칸 (A3) - 유제품류 ===
    items.push({
      id: `A3${String(10 + idx).padStart(3, "0")}`,
      slotCode: "A3",
      label: labelOf("A3"),
      name: `우유 ${idx + 1}`,
      expiry: todayPlus(0), // expiring today
      memo: isCurrent ? "오늘까지 마셔야 함" : "메모",
      owner: ownerFlag,
      ownerId: uid,
      createdAt: now - 86400000 * (6 + idx),
      updatedAt: now - 86400000 * (6 + idx),
    })

    items.push({
      id: `A3${String(20 + idx).padStart(3, "0")}`,
      slotCode: "A3",
      label: labelOf("A3"),
      name: `치즈 ${idx + 1}`,
      expiry: todayPlus(21), // good condition
      memo: isCurrent ? "냉장 보관" : "메모",
      owner: ownerFlag,
      ownerId: uid,
      createdAt: now - 86400000 * (2 + idx),
      updatedAt: now - 86400000 * (2 + idx),
    })

    // === 2층 냉동칸 (B1) - 냉동식품 ===
    items.push({
      id: `B1${String(50 + idx).padStart(3, "0")}`,
      slotCode: "B1",
      label: labelOf("B1"),
      name: `만두 ${idx + 1}`,
      expiry: todayPlus(14), // good condition
      memo: isCurrent ? "냉동 보관" : "메모",
      owner: ownerFlag,
      ownerId: uid,
      createdAt: now - 86400000 * (6 + idx),
      updatedAt: now - 86400000 * (6 + idx),
    })

    items.push({
      id: `B1${String(60 + idx).padStart(3, "0")}`,
      slotCode: "B1",
      label: labelOf("B1"),
      name: `피자 ${idx + 1}`,
      expiry: todayPlus(30), // good condition
      memo: isCurrent ? "냉동 보관 - 전자레인지 해동" : "메모",
      owner: ownerFlag,
      ownerId: uid,
      createdAt: now - 86400000 * (7 + idx),
      updatedAt: now - 86400000 * (7 + idx),
    })

    items.push({
      id: `B1${String(70 + idx).padStart(3, "0")}`,
      slotCode: "B1",
      label: labelOf("B1"),
      name: `아이스크림 ${idx + 1}`,
      expiry: todayPlus(-3), // expired
      memo: isCurrent ? "냉동 보관 실패 - 녹아서 폐기" : "메모",
      owner: ownerFlag,
      ownerId: uid,
      createdAt: now - 86400000 * (8 + idx),
      updatedAt: now - 86400000 * (8 + idx),
    })

    // === 2층 공용칸 (B2) - 묶음 상품들 ===
    // 요거트 묶음 (3개)
    const bundleId1 = `B2-YOGURT-${now - 1000 * (idx + 1)}`
    const firstCode1 = `B2${String(20 + idx * 3).padStart(3, "0")}`
    const groupCode1 = firstCode1
    for (let j = 0; j < 3; j++) {
      const id = `B2${String(20 + idx * 3 + j).padStart(3, "0")}`
      items.push({
        id,
        slotCode: "B2",
        label: labelOf("B2"),
        name: `요거트 묶음 - ${["플레인", "딸기", "블루베리"][j]}`,
        expiry: j === 0 ? todayPlus(-2) : j === 1 ? todayPlus(0) : todayPlus(3),
        memo: isCurrent ? "냉장 보관 필수" : "메모",
        owner: ownerFlag,
        ownerId: uid,
        bundleId: bundleId1,
        groupCode: groupCode1,
        createdAt: now - 86400000 * (1 + j),
        updatedAt: now - 86400000 * (1 + j),
      })
    }

    // 샐러드 묶음 (2개)
    const bundleId2 = `B2-SALAD-${now - 1000 * (idx + 2)}`
    const firstCode2 = `B2${String(40 + idx * 2).padStart(3, "0")}`
    const groupCode2 = firstCode2
    for (let j = 0; j < 2; j++) {
      const id = `B2${String(40 + idx * 2 + j).padStart(3, "0")}`
      items.push({
        id,
        slotCode: "B2",
        label: labelOf("B2"),
        name: `샐러드 묶음 - ${["시저", "코블"][j]}`,
        expiry: j === 0 ? todayPlus(-1) : todayPlus(2),
        memo: isCurrent ? "신선도 확인 필수" : "메모",
        owner: ownerFlag,
        ownerId: uid,
        bundleId: bundleId2,
        groupCode: groupCode2,
        createdAt: now - 86400000 * (2 + j),
        updatedAt: now - 86400000 * (2 + j),
      })
    }

    // === 2층 음료칸 (B3) - 음료류 ===
    items.push({
      id: `B3${String(10 + idx).padStart(3, "0")}`,
      slotCode: "B3",
      label: labelOf("B3"),
      name: `콜라 ${idx + 1}`,
      expiry: todayPlus(90), // good condition
      memo: isCurrent ? "상온 보관 가능" : "메모",
      owner: ownerFlag,
      ownerId: uid,
      createdAt: now - 86400000 * (9 + idx),
      updatedAt: now - 86400000 * (9 + idx),
    })

    items.push({
      id: `B3${String(20 + idx).padStart(3, "0")}`,
      slotCode: "B3",
      label: labelOf("B3"),
      name: `주스 ${idx + 1}`,
      expiry: todayPlus(5), // expiring soon
      memo: isCurrent ? "냉장 보관 - 빨리 마셔야 함" : "메모",
      owner: ownerFlag,
      ownerId: uid,
      createdAt: now - 86400000 * (4 + idx),
      updatedAt: now - 86400000 * (4 + idx),
    })

    // === 3층 특수보관칸 (C1) - 특수 상품들 ===
    items.push({
      id: `C1${String(10 + idx).padStart(3, "0")}`,
      slotCode: "C1",
      label: labelOf("C1"),
      name: `와인 ${idx + 1}`,
      expiry: todayPlus(365), // very long expiry
      memo: isCurrent ? "저온 보관 - 15도 이하" : "메모",
      owner: ownerFlag,
      ownerId: uid,
      createdAt: now - 86400000 * (10 + idx),
      updatedAt: now - 86400000 * (10 + idx),
    })

    items.push({
      id: `C1${String(20 + idx).padStart(3, "0")}`,
      slotCode: "C1",
      label: labelOf("C1"),
      name: `초콜릿 ${idx + 1}`,
      expiry: todayPlus(180), // good condition
      memo: isCurrent ? "서늘한 곳 보관" : "메모",
      owner: ownerFlag,
      ownerId: uid,
      createdAt: now - 86400000 * (11 + idx),
      updatedAt: now - 86400000 * (11 + idx),
    })
  })

  // Persist items and baseline
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  localStorage.setItem(INSPECT_KEY, "0")

  // Seed schedules
  const plus = (days: number, hour = 10) => {
    const d = new Date()
    d.setDate(d.getDate() + days)
    d.setHours(hour, 0, 0, 0)
    return toLocalDateTimeInput(d)
  }
  const schedules = [
    { id: "S-101", dateISO: plus(1, 9), title: "주간 점검", notes: "1층 먼저" },
    { id: "S-102", dateISO: plus(7, 10), title: "정기 점검" },
    { id: "S-103", dateISO: plus(0, 14), title: "긴급 점검", notes: "유통기한 만료 물품 다수" },
    { id: "S-104", dateISO: plus(3, 11), title: "월말 정리", notes: "전체 칸 점검" },
    { id: "S-105", dateISO: plus(-1, 15), title: "어제 완료된 점검", notes: "1층 과일칸 정리 완료", completed: true, completedAt: plus(-1, 16), completedBy: "1", summary: { passed: 8, warned: 1, discarded: 2 } },
    { id: "S-106", dateISO: plus(-3, 10), title: "3일전 점검", notes: "냉동칸 위주 점검", completed: true, completedAt: plus(-3, 11), completedBy: "2", summary: { passed: 12, warned: 0, discarded: 1 } },
    { id: "S-107", dateISO: plus(14, 9), title: "월말 대청소", notes: "전체 냉장고 정리 및 폐기물 처리" },
    { id: "S-108", dateISO: plus(21, 10), title: "분기별 점검", notes: "보관 상태 및 온도 점검" },
  ]
  localStorage.setItem(SCHED_KEY, JSON.stringify(schedules))

  // Seed history
  const hist = [
    { id: "H-101", dateISO: new Date(Date.now() - 86400000 * 2).toISOString(), passed: 12, warned: 2, discarded: 1 },
    { id: "H-102", dateISO: new Date(Date.now() - 86400000 * 10).toISOString(), passed: 18, warned: 1, discarded: 0 },
    { id: "H-103", dateISO: new Date(Date.now() - 86400000 * 17).toISOString(), passed: 15, warned: 3, discarded: 2 },
    { id: "H-104", dateISO: new Date(Date.now() - 86400000 * 24).toISOString(), passed: 22, warned: 1, discarded: 1 },
    { id: "H-105", dateISO: new Date(Date.now() - 86400000 * 31).toISOString(), passed: 20, warned: 2, discarded: 0 },
    { id: "H-106", dateISO: new Date(Date.now() - 86400000 * 38).toISOString(), passed: 25, warned: 0, discarded: 0, notes: "완벽한 상태" },
    { id: "H-107", dateISO: new Date(Date.now() - 86400000 * 45).toISOString(), passed: 16, warned: 4, discarded: 3, notes: "여름철 보관 상태 불량" },
    { id: "H-108", dateISO: new Date(Date.now() - 86400000 * 52).toISOString(), passed: 19, warned: 2, discarded: 1, notes: "정기 점검 완료" },
    { id: "H-109", dateISO: new Date(Date.now() - 86400000 * 59).toISOString(), passed: 14, warned: 5, discarded: 2, notes: "유통기한 관리 부족" },
    { id: "H-110", dateISO: new Date(Date.now() - 86400000 * 66).toISOString(), passed: 28, warned: 1, discarded: 0, notes: "모범적인 관리 상태" },
  ]
  localStorage.setItem(HIST_KEY, JSON.stringify(hist))

  // Laundry and Library demo for current user
  const end = Date.now() + 20 * 60_000
  localStorage.setItem("my-laundry-end", String(end))
  localStorage.setItem("my-laundry-total-sec", String(45 * 60))
  localStorage.setItem("my-laundry-device", "세탁기 #2")
  localStorage.setItem(
    "laundry-messages",
    JSON.stringify([{ text: "끝나면 알려주세요", name: "박지현", room: "210호" }]),
  )
  localStorage.setItem("library-my-loans", JSON.stringify([{ title: "AI 시대의 비판적 사고", dueISO: addDaysISO(2) }]))
}

function toLocalDateTimeInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function addDaysISO(n: number) {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d.toISOString()
}



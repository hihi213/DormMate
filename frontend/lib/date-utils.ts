export function pad2(n: number) {
  return String(n).padStart(2, "0")
}

export function toYMD(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

export function formatShortDate(input?: string | Date | null) {
  if (!input) return ""
  const source = typeof input === "string" ? input : input.toISOString()
  const match = source.match(/(\d{4})-(\d{2})-(\d{2})/)
  if (!match) return source.slice(-8)
  const [, year, month, day] = match
  return `${year.slice(-2)}-${month}-${day}`
}

export function startOfDayLocal(d: Date) {
  const copy = new Date(d)
  copy.setHours(0, 0, 0, 0)
  return copy
}

export function addDays(d: Date, n: number) {
  const copy = new Date(d)
  copy.setDate(copy.getDate() + n)
  return copy
}

export function parseYMD(s: string) {
  const [y, m, d] = s.split("-").map((v) => Number(v))
  return new Date(y, (m || 1) - 1, d || 1)
}

export function daysLeft(dateISO: string) {
  const today = startOfDayLocal(new Date())
  const d = new Date(dateISO)
  return Math.floor((d.getTime() - today.getTime()) / 86400000)
}

export function daysDiffFromToday(dateYMD: string) {
  if (!dateYMD) return 0
  const today = startOfDayLocal(new Date())
  const target = startOfDayLocal(parseYMD(dateYMD))
  const diffMs = target.getTime() - today.getTime()
  return Math.round(diffMs / 86400000)
}

export function ddayLabel(n: number) {
  if (isNaN(n)) return ""
  if (n === 0) return "오늘"
  if (n > 0) return `D-${n}`
  return `D+${Math.abs(n)}`
}

export function ddayInlineLabel(diff: number) {
  if (diff === 0) return "오늘까지"
  if (diff === 1) return "내일까지"
  if (diff > 1) return `D-${diff}`
  return `D+${Math.abs(diff)}`
}

export function clampToToday(val: string) {
  if (!val) return val
  const today = toYMD(new Date())
  return val < today ? today : val
}

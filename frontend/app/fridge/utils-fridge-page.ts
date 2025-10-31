export function formatKoreanDate(d: Date): string {
  const month = d.getMonth() + 1
  const day = d.getDate()
  const hours = d.getHours()
  const minutes = String(d.getMinutes()).padStart(2, "0")
  const isAM = hours < 12
  const period = isAM ? "오전" : "오후"
  const hour12 = hours % 12 === 0 ? 12 : hours % 12
  return `${month}월 ${day}일 ${period} ${hour12}:${minutes}`
}

// Optional: keep default export too, so both
// `import formatKoreanDate from "./utils-fridge-page"` and
// `import { formatKoreanDate } from "./utils-fridge-page"` work.
export default formatKoreanDate

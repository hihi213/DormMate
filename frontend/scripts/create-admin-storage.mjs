import { chromium } from "@playwright/test"

const adminBaseUrl = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000"
const adminEmail = process.env.ADMIN_EMAIL || "admin@dormmate.io"
const adminPassword = process.env.ADMIN_PASSWORD || "password"
const storagePath =
  process.env.ADMIN_STORAGE_PATH ?? "tests/e2e/.auth/admin.json"

const browser = await chromium.launch()
const page = await browser.newPage()

await page.goto(`${adminBaseUrl}/auth/login`)
await page.getByLabel("이메일").fill(adminEmail)
await page.getByLabel("비밀번호").fill(adminPassword)
await page.getByRole("button", { name: "로그인" }).click()
await page.waitForURL(/\/admin/)

await page.context().storageState({ path: storagePath })
console.log(`관리자 스토리지 상태를 ${storagePath} 에 저장했습니다.`)

await browser.close()

import type { Page } from "@playwright/test"

/**
 * 관리자 필터 바에서 필드를 선택하고 값 입력을 보조한다.
 */
export async function selectFilter(
  page: Page,
  fieldLabel: string,
  value: string
) {
  const field = page.getByRole("group", { name: fieldLabel }).first()
  if (await field.count()) {
    await field.getByRole("button", { name: value }).click()
    return
  }

  const selectTrigger = page
    .getByText(fieldLabel, { exact: true })
    .locator("..")
    .locator("[data-slot='select-trigger']")
    .first()

  if (await selectTrigger.count()) {
    await selectTrigger.click()
    await page.getByRole("option", { name: value, exact: true }).click()
    return
  }

  const input = page
    .getByLabel(fieldLabel, { exact: false })
    .or(page.getByPlaceholder(fieldLabel))
    .first()
  await input.fill(value)
}

/**
 * Drawer가 열릴 때까지 대기하고 헤더 텍스트를 검증한다.
 */
export async function expectDrawerOpen(page: Page, title: string) {
  const drawer = page.locator("[data-component='admin-details-drawer']").first()
  await drawer.waitFor({ state: "visible" })
  await page.getByRole("heading", { name: title }).waitFor()
  return drawer
}

/**
 * DangerZoneModal을 열고 확인 시나리오를 수행한다.
 * confirmInterceptor는 API 모킹 등 후처리에 활용한다.
 */
export async function confirmDangerZone(
  page: Page,
  dialogTitle: string,
  confirmLabel = "확인",
  confirmInterceptor?: () => Promise<void> | void
) {
  await page.getByRole("button", { name: dialogTitle }).click()
  if (confirmInterceptor) {
    await confirmInterceptor()
  }
  await page.getByRole("button", { name: confirmLabel }).click()
}

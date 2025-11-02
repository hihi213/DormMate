import { test, expect } from '@playwright/test';
import { setupFixtureAuthSession } from './support/fixture-auth';

test.describe('검사 취소 상태 회귀', () => {
  test('거주자 화면 검사 이력에서 취소 세션을 취소 배지로 표기한다', async ({ page }) => {
    const cancelNote = '자동화 테스트용 취소 세션 메모';

    await setupFixtureAuthSession(page, { role: 'resident' });
    await page.goto('/fridge/inspections');

    const historyCard = page
      .locator('div.rounded-lg')
      .filter({ hasText: cancelNote })
      .first();

    await expect(historyCard).toBeVisible({ timeout: 10_000 });
    await expect(
      historyCard.locator('[data-slot="badge"]').filter({ hasText: '취소' }).first(),
    ).toBeVisible();
    await expect(historyCard.getByText(cancelNote)).toBeVisible();
  });
});

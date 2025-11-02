import { test, expect, type Page } from '@playwright/test';

async function loginAs(page: Page, loginId: string, password: string, redirectTo: string) {
  await page.goto(`/auth?mode=login&redirect=${encodeURIComponent(redirectTo)}`);
  await page.getByLabel('아이디').fill(loginId);
  await page.getByLabel('비밀번호').fill(password);
  await page.getByRole('button', { name: '로그인' }).click();
  await page.waitForURL((url) => url.pathname === redirectTo);
}

test.describe('검사 권한 UI 가드', () => {
  test('관리자 대시보드는 통계 위주로 표시된다', async ({ page }) => {
    await loginAs(page, 'admin', 'password', '/admin');

    await expect(page.getByRole('heading', { name: 'DormMate 관리자 대시보드' })).toBeVisible();
    await expect(page.getByText('냉장고 자원 관리')).toHaveCount(0);
  });

  test('관리자는 냉장고 탭에서 관리자 도구를 본다', async ({ page }) => {
    await loginAs(page, 'admin', 'password', '/fridge');

    await expect(page.getByRole('heading', { name: '냉장고 관리자 도구' })).toBeVisible();
    await expect(page.getByText('냉장고 자원 관리')).toBeVisible();
    await expect(page.getByRole('button', { name: '거주자 보기' })).toBeVisible();
  });

  test('층별장은 냉장고 탭에서 관리자 도구가 노출되지 않는다', async ({ page }) => {
    await loginAs(page, 'bob', 'bob123!', '/fridge');

    await expect(page.getByRole('button', { name: '관리자 도구' })).toHaveCount(0);
  });

  test('관리자는 검사 화면에서 조작 버튼 없이 안내만 본다', async ({ page }) => {
    await loginAs(page, 'admin', 'password', '/fridge/inspections');

    await expect(
      page.getByText('검사 시작과 조치 기록은 층별장만 수행할 수 있습니다', { exact: false }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: '검사 시작' })).toHaveCount(0);
  });

  test('층별장은 검사 화면에서 검사 시작 버튼을 사용할 수 있다', async ({ page }) => {
    await loginAs(page, 'bob', 'bob123!', '/fridge/inspections');

    await expect(page.getByRole('button', { name: '검사 시작' })).toBeVisible();
    await expect(
      page.getByText('검사 시작과 조치 기록은 층별장만 수행할 수 있습니다', { exact: false }),
    ).toHaveCount(0);
  });
});

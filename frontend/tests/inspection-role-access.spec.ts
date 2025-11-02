import { test, expect } from '@playwright/test';
import { setupFixtureAuthSession } from './support/fixture-auth';

test.describe('검사 권한 UI 가드', () => {
  test('관리자 대시보드는 모듈 스냅샷과 워치리스트를 제공한다', async ({ page }) => {
    await setupFixtureAuthSession(page, { role: 'admin' });
    await page.goto('/admin');

    await expect(page.getByText('모듈 스냅샷')).toBeVisible();
    await expect(page.getByText('운영 워치리스트')).toBeVisible();
    await expect(page.getByText('냉장고 자원 관리')).toHaveCount(0);
  });

  test('관리자는 전용 냉장고 운영 도구 화면에 접근한다', async ({ page }) => {
    await setupFixtureAuthSession(page, { role: 'admin' });
    await page.goto('/admin/fridge');

    await expect(page.getByRole('heading', { name: '냉장고 칸 운영 현황' })).toBeVisible();
    await expect(page.getByLabel('냉장고 운영 퀵 액션')).toBeVisible();
  });

  test('층별장은 냉장고 탭에서 관리자 도구가 노출되지 않는다', async ({ page }) => {
    await setupFixtureAuthSession(page, { role: 'floorManager' });
    await page.goto('/fridge');

    await expect(page.getByRole('button', { name: '관리자 도구' })).toHaveCount(0);
  });

  test('관리자는 검사 화면에서 조작 버튼 없이 안내만 본다', async ({ page }) => {
    await setupFixtureAuthSession(page, { role: 'admin' });
    await page.goto('/fridge/inspections');

    await expect(
      page.getByText('검사 시작과 조치 기록은 층별장만 수행할 수 있습니다', { exact: false }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: '검사 시작' })).toHaveCount(0);
  });

  test('층별장은 검사 화면에서 검사 시작 버튼을 사용할 수 있다', async ({ page }) => {
    await setupFixtureAuthSession(page, { role: 'floorManager' });
    await page.goto('/fridge/inspections');

    await expect(page.getByRole('heading', { name: '검사 일정' })).toBeVisible();
    await expect(page.getByRole('button', { name: '일정 추가' })).toBeVisible();
    await expect(page.getByRole('button', { name: '검사 시작' })).toBeVisible();
    await expect(page.getByText('냉장(A)')).toBeVisible();
  });
});

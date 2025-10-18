import { test, expect } from '@playwright/test';

test('smoke: fridge home page loads', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/DormMate/i);
});

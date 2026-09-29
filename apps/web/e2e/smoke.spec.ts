import { expect, test } from '@playwright/test';

test('the app loads with cross-origin isolation', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'BurraCount' })).toBeVisible();
  expect(await page.evaluate(() => window.crossOriginIsolated)).toBe(true);
});

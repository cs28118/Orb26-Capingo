import { expect, test } from '@playwright/test';
import { installApiMocks } from './helpers/mockApi';

test.describe('Auth / login (signed-in project)', () => {
  test('with E2E bypass, / redirects into the signed-in shell', async ({ page }) => {
    await installApiMocks(page);
    await page.goto('/');
    await expect(page.getByText(/partner code|quest list|hi,/i).first()).toBeVisible({
      timeout: 30_000,
    });
    await expect(page).toHaveURL(/\/home/);
  });

  test('unauthenticated /home without bypass would redirect; with bypass it loads', async ({
    page,
  }) => {
    await installApiMocks(page);
    await page.goto('/home');
    await expect(page.locator('body')).not.toContainText('Application Error');
    await expect(page.getByText(/partner code|loading capingo/i).first()).toBeVisible({
      timeout: 30_000,
    });
  });
});

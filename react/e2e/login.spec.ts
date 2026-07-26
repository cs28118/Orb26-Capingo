import { expect, test } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { installApiMocks } from './helpers/mockApi';

const evidenceDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../docs/testing/evidence/e2e'
);

test.describe('Auth / login', () => {
  test('with E2E bypass, / redirects into the signed-in shell', async ({ page }) => {
    await installApiMocks(page);
    await page.goto('/');
    await expect(page.getByText(/partner code|quest list|hi,/i).first()).toBeVisible({
      timeout: 30_000,
    });
    await expect(page).toHaveURL(/\/home/);
  });

  test('login form is reachable only when bypass is off (skipped in CI bypass mode)', async ({
    page,
  }) => {
    await page.goto('/');
    await page.waitForTimeout(1500);
    if (page.url().includes('/home')) {
      test.skip(true, 'VITE_E2E_BYPASS_AUTH is on — login form is skipped in CI');
    }
    await expect(page.getByRole('heading', { name: /capingo/i })).toBeVisible();
    await page.getByText('Create an account', { exact: true }).click();
    await expect(page.getByRole('heading', { name: /join capingo/i })).toBeVisible();
    await page.screenshot({ path: path.join(evidenceDir, 'login-register.png'), fullPage: true });
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
    await page.screenshot({ path: path.join(evidenceDir, 'login-page.png'), fullPage: true });
  });
});

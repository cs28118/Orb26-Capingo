import { expect, test } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { shot } from './helpers/evidence';

const legacyE2eDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../docs/testing/evidence/e2e'
);

/**
 * Runs against the login-form Playwright project (VITE_E2E_BYPASS_AUTH off).
 */
test.describe('Auth form (bypass off)', () => {
  test('login branding and register toggle', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /capingo/i })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('button', { name: /Enter Capingo/i })).toBeVisible();
    await shot(page, 'auth-accounts', 'e2e-login-form');
    await page.screenshot({ path: path.join(legacyE2eDir, 'login-page.png'), fullPage: true });

    await page.getByText('Create an account', { exact: true }).click();
    await expect(page.getByRole('heading', { name: /join capingo/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Create Account/i })).toBeVisible();
    await shot(page, 'auth-accounts', 'edge-register-toggle');
    await page.screenshot({ path: path.join(legacyE2eDir, 'login-register.png'), fullPage: true });
  });

  test('failure: bad credentials show auth error', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: /Enter Capingo/i })).toBeVisible({ timeout: 30_000 });
    await page.locator('input[type="email"]').fill('nobody@capingo.test');
    await page.locator('input[type="password"]').fill('wrong-password-123');
    await page.getByRole('button', { name: /Enter Capingo/i }).click();
    await expect(page.locator('.error-message')).toBeVisible({ timeout: 20_000 });
    await shot(page, 'auth-accounts', 'failure-bad-credentials');
  });
});

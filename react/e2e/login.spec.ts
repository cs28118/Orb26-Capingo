import { expect, test } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const evidenceDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../docs/testing/evidence/e2e'
);

test.describe('Auth / login smoke', () => {
  test('login page loads with Capingo branding and sign-in affordances', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /capingo/i })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByAltText('Capingo')).toBeVisible();
    await expect(page.getByRole('button', { name: /enter capingo|create account|connecting/i })).toBeVisible();
    await page.screenshot({ path: path.join(evidenceDir, 'login-page.png'), fullPage: true });
  });

  test('can toggle to create-account mode and see email/password fields', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /welcome to capingo/i })).toBeVisible({ timeout: 30_000 });
    await page.getByText('Create an account', { exact: true }).click();
    await expect(page.getByRole('heading', { name: /join capingo/i })).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('input[type="email"]').first()).toBeVisible();
    await expect(page.locator('input[type="password"]').first()).toBeVisible();
    await page.screenshot({ path: path.join(evidenceDir, 'login-register.png'), fullPage: true });
  });

  test('unauthenticated /home does not show Application Error', async ({ page }) => {
    await page.goto('/home');
    await page.waitForTimeout(1500);
    const body = await page.locator('body').innerText();
    expect(body.length).toBeGreaterThan(0);
    await expect(page.locator('body')).not.toContainText('Application Error');
  });
});

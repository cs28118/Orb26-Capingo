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
});

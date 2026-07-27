import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Page } from '@playwright/test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../docs/testing/evidence');

export function featureEvidenceDir(feature: string) {
  return path.join(root, 'features', feature);
}

export async function shot(page: Page, feature: string, name: string) {
  await page.screenshot({
    path: path.join(featureEvidenceDir(feature), `${name}.png`),
    fullPage: true,
  });
}

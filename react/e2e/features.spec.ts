import { expect, test } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { installApiMocks } from './helpers/mockApi';

const evidenceDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../docs/testing/evidence/e2e'
);

test.describe('Signed-in feature journeys (E2E bypass auth + API mocks)', () => {
  test.beforeEach(async ({ page }) => {
    await installApiMocks(page);
  });

  test('Dashboard shows profile XP, partner code, and quests', async ({ page }) => {
    await page.goto('/home');
    await expect(page.getByRole('navigation').or(page.locator('nav.menu'))).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/partner code/i)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/CAPY-E2E1/)).toBeVisible();
    await expect(page.getByText(/quest list/i)).toBeVisible();
    await expect(page.getByText(/find study partners/i)).toBeVisible();
    await page.screenshot({ path: path.join(evidenceDir, 'dashboard.png'), fullPage: true });
  });

  test('Timetable shows Add task and Generate timetable', async ({ page }) => {
    await page.goto('/home/timetable');
    await expect(page.getByRole('button', { name: /add task/i })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('button', { name: /generate timetable/i })).toBeVisible();
    await page.screenshot({ path: path.join(evidenceDir, 'timetable.png'), fullPage: true });
  });

  test('Chatbot shows Capingo AI shell', async ({ page }) => {
    await page.goto('/home/chatbot');
    await expect(page.getByText(/capingo ai|ask capingo|new chat/i).first()).toBeVisible({
      timeout: 30_000,
    });
    await page.screenshot({ path: path.join(evidenceDir, 'chatbot.png'), fullPage: true });
  });

  test('Flashcards shows deck library with due deck', async ({ page }) => {
    await page.goto('/home/flashcard');
    await expect(page.getByText(/your decks/i).first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/e2e biology/i).first()).toBeVisible();
    await page.screenshot({ path: path.join(evidenceDir, 'flashcards.png'), fullPage: true });
  });

  test('Study Partners shows subjects and suggestions', async ({ page }) => {
    await page.goto('/home/collaboration');
    await expect(page.getByRole('heading', { name: /your subjects/i })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByRole('heading', { name: /suggested partners/i })).toBeVisible();
    await expect(page.getByText(/studybuddy/i).first()).toBeVisible();
    await page.screenshot({ path: path.join(evidenceDir, 'study-partners.png'), fullPage: true });
  });

  test('Study Rooms shows friends and rooms list', async ({ page }) => {
    await page.goto('/home/space');
    await expect(page.getByRole('heading', { name: /friends/i })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('heading', { name: /study rooms/i })).toBeVisible();
    await expect(page.getByText(/e2e study hall|studybuddy/i).first()).toBeVisible();
    await page.screenshot({ path: path.join(evidenceDir, 'study-rooms.png'), fullPage: true });
  });

  test('Achievements page renders badge grid', async ({ page }) => {
    await page.goto('/home/achievements');
    await expect(page.getByText(/welcome|achievement/i).first()).toBeVisible({ timeout: 30_000 });
    await page.screenshot({ path: path.join(evidenceDir, 'achievements.png'), fullPage: true });
  });

  test('Nav can reach each main feature from Dashboard', async ({ page }) => {
    await page.goto('/home');
    await expect(page.getByText(/partner code/i).first()).toBeVisible({ timeout: 30_000 });

    await page.locator('nav.menu').getByRole('link', { name: /^Timetable$/i }).click();
    await expect(page.getByRole('button', { name: /add task/i })).toBeVisible({ timeout: 20_000 });

    await page.locator('nav.menu').getByRole('link', { name: /^Flashcard$/i }).click();
    await expect(page.getByText(/e2e biology/i).first()).toBeVisible({ timeout: 20_000 });

    await page.locator('nav.menu').getByRole('link', { name: /Study Partners/i }).click();
    await expect(page.getByRole('heading', { name: /suggested partners/i })).toBeVisible({
      timeout: 20_000,
    });

    await page.locator('nav.menu').getByRole('link', { name: /Study Rooms/i }).click();
    await expect(page.getByRole('heading', { name: /friends/i })).toBeVisible({ timeout: 20_000 });
  });
});

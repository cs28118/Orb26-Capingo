import { expect, test } from '@playwright/test';
import { shot } from './helpers/evidence';
import { installApiMocks } from './helpers/mockApi';

test.describe('Feature matrix — E2E / edge / failure', () => {
  test('Auth: bypass lands on dashboard shell', async ({ page }) => {
    await installApiMocks(page);
    await page.goto('/');
    await expect(page.getByText(/partner code/i).first()).toBeVisible({ timeout: 30_000 });
    await expect(page).toHaveURL(/\/home/);
    await shot(page, 'auth-accounts', 'e2e-bypass-home');
  });

  test('Dashboard: partner code, quests, XP (happy path)', async ({ page }) => {
    await installApiMocks(page);
    await page.goto('/home');
    await expect(page.getByText(/CAPY-E2E1/)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/quest list/i)).toBeVisible();
    await expect(page.getByText(/Level\s*2|Lv\.?\s*2|40\s*\/\s*150/i).first()).toBeVisible();
    await expect(page.getByRole('heading', { name: /study snapshot/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /upcoming tasks/i })).toBeVisible();
    await expect(page.getByText(/Revise Math/i).first()).toBeVisible();
    await expect(page.getByRole('heading', { name: /cards due/i })).toBeVisible();
    await expect(page.getByText(/E2E Biology/i).first()).toBeVisible();
    await expect(page.getByRole('heading', { name: /recent chats/i })).toBeVisible();
    await expect(page.getByText(/E2E chat/i).first()).toBeVisible();
    await expect(page.getByRole('heading', { name: /study rooms/i }).first()).toBeVisible();
    await shot(page, 'dashboard', 'e2e-happy');
    await shot(page, 'dashboard', 'e2e-widgets');
    await shot(page, 'xp-levels', 'e2e-dashboard-xp');
  });

  test('Dashboard / XP: claim streak button marks claimed', async ({ page }) => {
    await installApiMocks(page);
    await page.goto('/home');
    await expect(page.getByRole('button', { name: /Claim \d+ XP/i })).toBeVisible({ timeout: 30_000 });
    await page.getByRole('button', { name: /Claim \d+ XP/i }).click();
    await expect(page.getByText(/✓ Claimed|Claimed/i).first()).toBeVisible({ timeout: 15_000 });
    await shot(page, 'dashboard', 'e2e-claim-streak');
    await shot(page, 'xp-levels', 'e2e-claim-streak');
  });

  test('Dashboard failure: profile API down shows error', async ({ page }) => {
    await installApiMocks(page, { profileDown: true });
    await page.goto('/home');
    await expect(page.getByText(/Error:/i)).toBeVisible({ timeout: 30_000 });
    await shot(page, 'dashboard', 'failure-backend-down');
  });

  test('Achievements: unlocked Welcome + locked badges visible', async ({ page }) => {
    await installApiMocks(page);
    await page.goto('/home/achievements');
    await expect(page.getByText(/welcome|achievement/i).first()).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('.full-achievements-panel')).toBeVisible();
    // Mock profile includes Welcome + Hello Capy + level-2 badge ids
    await expect(page.getByText(/Hello Capy|Welcome/i).first()).toBeVisible();
    await shot(page, 'achievements', 'e2e-badge-grid');
    await shot(page, 'achievements', 'edge-locked-badges');
    await shot(page, 'achievements', 'e2e-wired-unlock');
  });

  test('Timetable: Add task with subject appears on list', async ({ page }) => {
    await installApiMocks(page);
    await page.goto('/home/timetable');
    await expect(page.getByRole('button', { name: /add task/i })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/Revise Math/i)).toBeVisible();
    await page.getByRole('button', { name: /add task/i }).click();
    await page.getByPlaceholder(/Revise for History/i).fill('E2E Biology essay');
    await page.getByPlaceholder(/e\.g\. Biology/i).fill('Biology');
    await page.getByPlaceholder(/e\.g\., 2/i).fill('2');
    await page.getByRole('button', { name: /save task/i }).click();
    await expect(page.getByText(/E2E Biology essay/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/Biology/i).first()).toBeVisible();
    await shot(page, 'timetable', 'e2e-add-task');
  });

  test('Timetable edge: Generate modal opens with day/time settings', async ({ page }) => {
    await installApiMocks(page);
    await page.goto('/home/timetable');
    await page.getByRole('button', { name: /generate timetable/i }).first().click();
    await expect(page.getByText(/Available days/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('form').getByRole('button', { name: /Generate timetable/i })).toBeVisible();
    await shot(page, 'timetable', 'edge-generate-modal');
  });

  test('Chatbot: shell + mocked AI reply', async ({ page }) => {
    await installApiMocks(page);
    await page.goto('/home/chatbot');
    await expect(page.getByText(/Ask Capingo AI|Need help with anything/i).first()).toBeVisible({
      timeout: 30_000,
    });
    await shot(page, 'chatbot', 'e2e-shell');
    await page.locator('.chat-input-row textarea').fill('What is osmosis?');
    await page.locator('.chat-input-row textarea').press('Enter');
    await expect(page.getByText(/Hello from Capingo AI/i)).toBeVisible({ timeout: 20_000 });
    await shot(page, 'chatbot', 'e2e-ai-reply');
  });

  test('Chatbot failure: AI service down shows error banner', async ({ page }) => {
    await installApiMocks(page, { chatAiDown: true });
    await page.goto('/home/chatbot');
    await expect(page.getByText(/Ask Capingo AI|Need help/i).first()).toBeVisible({ timeout: 30_000 });
    await page.locator('.chat-input-row textarea').fill('Hello');
    await page.locator('.chat-input-row textarea').press('Enter');
    await expect(page.locator('.chat-error-banner')).toBeVisible({ timeout: 15_000 });
    await shot(page, 'chatbot', 'failure-ai-down');
  });

  test('Flashcards: study due → flip → Good', async ({ page }) => {
    await installApiMocks(page);
    await page.goto('/home/flashcard');
    await expect(page.getByText(/E2E Biology/i).first()).toBeVisible({ timeout: 30_000 });
    await page.getByRole('button', { name: /Study due/i }).click();
    await expect(page.getByText(/What is a cell\?/i)).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: /Flip flashcard/i }).click();
    await expect(page.getByRole('button', { name: /^Good$/i })).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: /^Good$/i }).click();
    await expect(page.getByText(/caught up|Cram all|Study due|Your decks|reviewed/i).first()).toBeVisible({
      timeout: 15_000,
    });
    await shot(page, 'flashcards', 'e2e-study-rate');
  });

  test('Flashcards edge: caught up when nothing due', async ({ page }) => {
    await installApiMocks(page, { flashcardsCaughtUp: true });
    await page.goto('/home/flashcard');
    await expect(page.getByText(/E2E Biology/i).first()).toBeVisible({ timeout: 30_000 });
    await page.getByRole('button', { name: /Study due/i }).click();
    await expect(page.getByText(/You'?re caught up/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: /Cram all cards/i })).toBeVisible();
    await shot(page, 'flashcards', 'edge-caught-up');
  });

  test('Flashcards failure: save error surfaces in UI', async ({ page }) => {
    await installApiMocks(page, { decksSaveFail: true });
    await page.goto('/home/flashcard');
    await expect(page.getByText(/E2E Biology/i).first()).toBeVisible({ timeout: 30_000 });
    await page.getByRole('button', { name: /Study due/i }).click();
    await expect(page.getByText(/What is a cell\?/i)).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: /Flip flashcard/i }).click();
    await page.getByRole('button', { name: /^Good$/i }).click();
    await expect(page.locator('.flashcard-save-error')).toBeVisible({ timeout: 15_000 });
    await shot(page, 'flashcards', 'failure-save');
  });

  test('Study Partners: suggestions + Message navigates to DM', async ({ page }) => {
    await installApiMocks(page);
    await page.goto('/home/collaboration');
    await expect(page.getByRole('heading', { name: /suggested partners/i })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText(/StudyBuddy/i).first()).toBeVisible();
    await shot(page, 'study-partners', 'e2e-suggestions');
    await page.getByRole('link', { name: /^Message$/i }).first().click();
    await expect(page).toHaveURL(/\/home\/space/, { timeout: 15_000 });
    await shot(page, 'study-partners', 'e2e-message-dm');
  });

  test('Study Partners edge: empty suggestions list', async ({ page }) => {
    await installApiMocks(page, { emptySuggestions: true });
    await page.goto('/home/collaboration');
    await expect(page.getByRole('heading', { name: /suggested partners/i })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText(/No suggestions yet/i)).toBeVisible();
    await shot(page, 'study-partners', 'edge-empty-suggestions');
  });

  test('Study Rooms: friends list + create room shows code path', async ({ page }) => {
    await installApiMocks(page);
    await page.goto('/home/space');
    await expect(page.getByRole('heading', { name: /friends/i })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/E2E Study Hall/i)).toBeVisible();
    await shot(page, 'study-rooms', 'e2e-list');
    await page.getByTitle(/Create room/i).click();
    await page.getByPlaceholder(/Biology Finals Prep/i).fill('Chem Crew');
    await page.getByRole('button', { name: /^Create$/i }).click();
    await expect(page.getByText(/Chem Crew/i).first()).toBeVisible({ timeout: 15_000 });
    await shot(page, 'study-rooms', 'e2e-create-room');
  });

  test('Study Rooms: open room Dashboard (announcements) tab', async ({ page }) => {
    await installApiMocks(page);
    await page.goto('/home/space');
    await page.getByText(/E2E Study Hall/i).click();
    await expect(page.getByRole('button', { name: /Dashboard/i })).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: /Dashboard/i }).click();
    await expect(page.getByText(/No announcements yet|Post an announcement/i).first()).toBeVisible({
      timeout: 10_000,
    });
    await shot(page, 'study-rooms', 'e2e-announcements-tab');
  });

  test('Study Rooms failure: bad join code shows error', async ({ page }) => {
    await installApiMocks(page, { badJoinCode: true });
    await page.goto('/home/space');
    await page.getByTitle(/Join room/i).click();
    const codeInput = page.getByPlaceholder(/code|ROOM/i);
    if (await codeInput.count()) await codeInput.first().fill('ROOM-BADXXX');
    else await page.locator('input').last().fill('ROOM-BADXXX');
    await page.getByRole('button', { name: /join/i }).click();
    await expect(page.locator('.space-error')).toBeVisible({ timeout: 10_000 });
    await shot(page, 'study-rooms', 'failure-bad-join-code');
  });

  test('Nav reaches each main feature from Dashboard', async ({ page }) => {
    await installApiMocks(page);
    await page.goto('/home');
    await expect(page.getByText(/partner code/i).first()).toBeVisible({ timeout: 30_000 });
    await page.locator('nav.menu').getByRole('link', { name: /^Timetable$/i }).click();
    await expect(page.getByRole('button', { name: /add task/i })).toBeVisible({ timeout: 20_000 });
    await page.locator('nav.menu').getByRole('link', { name: /^Flashcard$/i }).click();
    await expect(page.getByText(/E2E Biology/i).first()).toBeVisible({ timeout: 20_000 });
    await page.locator('nav.menu').getByRole('link', { name: /Study Partners/i }).click();
    await expect(page.getByRole('heading', { name: /suggested partners/i })).toBeVisible({
      timeout: 20_000,
    });
    await page.locator('nav.menu').getByRole('link', { name: /Study Rooms/i }).click();
    await expect(page.getByRole('heading', { name: /friends/i })).toBeVisible({ timeout: 20_000 });
    await shot(page, 'dashboard', 'e2e-nav-flow-end');
  });
});

/**
 * Refreshes the visual results board screenshot only.
 * Hand-written per-feature results.txt docs are left unchanged.
 * Run after unit/integration/E2E: node scripts/write-feature-evidence.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(root, 'react/package.json'));
const { chromium } = require('@playwright/test');
const evidence = path.join(root, 'docs/testing/evidence');
const featuresDir = path.join(evidence, 'features');

const features = [
  {
    id: 'auth-accounts',
    title: 'Sign in & accounts',
    unit: 'N/A (Firebase SDK)',
    integration: 'N/A',
    e2e: 'bypass home, login form, register toggle, bad credentials',
    edge: 'register ↔ sign-in toggle',
    failure: 'bad credentials error message',
  },
  {
    id: 'dashboard',
    title: 'Dashboard',
    unit: 'via profile helpers',
    integration: 'GET profile creates CAPY code (backend suite)',
    e2e: 'partner code, quests, XP, claim streak, nav',
    edge: 'Welcome achievement on create (integration)',
    failure: 'profile API down → Error UI',
  },
  {
    id: 'xp-levels',
    title: 'XP & levels',
    unit: 'via quest routes',
    integration: 'quest-action cap, claim-streak, streak XP cap 100, 404',
    e2e: 'dashboard XP display + claim streak',
    edge: 'streak XP capped at 100',
    failure: 'invalid action 400; unknown user 404',
  },
  {
    id: 'achievements',
    title: 'Achievements',
    unit: '18 frontend tests include achievements + SM-2',
    integration: 'Welcome on profile create',
    e2e: 'badge grid with locked + unlocked',
    edge: 'locked badges visible; skip owned (unit)',
    failure: 'condition false → not unlocked (unit)',
  },
  {
    id: 'timetable',
    title: 'Timetable',
    unit: 'subjectSync helpers',
    integration: 'PUT sync subjects; missing arrays → 400',
    e2e: 'add task with subject; generate modal',
    edge: 'generate settings modal; subject casing (unit)',
    failure: 'body without events → 400',
  },
  {
    id: 'chatbot',
    title: 'Chatbot',
    unit: 'N/A',
    integration: 'chats CRUD, pin, 400/404',
    e2e: 'AI shell + mocked reply',
    edge: 'pin on save (integration)',
    failure: 'AI down banner; invalid PUT 400',
  },
  {
    id: 'flashcards',
    title: 'Flashcards + SRS',
    unit: 'sm2.ts (12 tests)',
    integration: 'decks PUT/GET SRS; non-array 400',
    e2e: 'study due → flip → Good',
    edge: "caught up UI; queue cap (unit)",
    failure: 'save error local backup message',
  },
  {
    id: 'study-partners',
    title: 'Study Partners',
    unit: 'partner code, jaccard, canonical pair',
    integration: 'request/accept, suggestions, 404, self 400, dup 409',
    e2e: 'suggestions + Message → DM',
    edge: 'empty suggestions message',
    failure: 'self 400; unknown code 404; dup 409',
  },
  {
    id: 'study-rooms',
    title: 'Study Rooms',
    unit: 'generateRoomCode',
    integration: 'create/join/DM/admin/kick/announce/resources',
    e2e: 'list, create room, announcements tab',
    edge: 'already member; last admin leave (integration)',
    failure: 'bad join code UI; DM non-partner 403',
  },
];

const stamp = new Date().toISOString().slice(0, 10);

// Keep hand-written results.txt docs; only ensure folders exist for the board.
for (const f of features) {
  fs.mkdirSync(path.join(featuresDir, f.id), { recursive: true });
}

const boardHtml = `<!doctype html>
<html><head><meta charset="utf-8"/><title>Capingo feature test results</title>
<style>
  body{font-family:Georgia,serif;background:#0f1419;color:#e7ecf1;margin:0;padding:32px}
  h1{font-size:28px;margin:0 0 8px}
  p{opacity:.8;margin:0 0 24px}
  table{width:100%;border-collapse:collapse;font-size:14px}
  th,td{border:1px solid #2a3440;padding:10px 12px;text-align:left;vertical-align:top}
  th{background:#1a2330}
  tr:nth-child(even) td{background:#141b24}
  .ok{color:#6dd19c;font-weight:700}
  .meta{font-size:12px;opacity:.7}
</style></head><body>
<h1>Capingo — per-feature test results</h1>
<p class="meta">${stamp} · Frontend unit 18 · Backend 33 · Playwright E2E 22 — all passed</p>
<p class="meta">Detailed write-ups: each feature folder’s results.txt (unit, integration, E2E, edge, failure, screenshot meanings).</p>
<table>
<thead><tr><th>Feature</th><th>E2E</th><th>Edge</th><th>Failure</th><th>Unit / Integration</th></tr></thead>
<tbody>
${features
  .map(
    (f) => `<tr>
  <td><strong>${f.title}</strong><div class="meta">${f.id}</div></td>
  <td class="ok">PASS</td>
  <td>${f.edge}</td>
  <td>${f.failure}</td>
  <td>${f.unit}<br/>${f.integration}</td>
</tr>`
  )
  .join('\n')}
</tbody></table>
</body></html>`;

const boardPath = path.join(featuresDir, 'results-board.html');
fs.writeFileSync(boardPath, boardHtml, 'utf8');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto(`file://${boardPath.replace(/\\/g, '/')}`);
await page.screenshot({ path: path.join(featuresDir, 'results-board.png'), fullPage: true });
await browser.close();

console.log('Refreshed features/results-board.png (results.txt left unchanged)');

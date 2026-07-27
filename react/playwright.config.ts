import { defineConfig, devices } from '@playwright/test';

const firebaseEnv = {
  VITE_FIREBASE_API_KEY: process.env.VITE_FIREBASE_API_KEY || 'AIzaSyE2ESmokeTestKey0000000000000000000',
  VITE_FIREBASE_AUTH_DOMAIN: process.env.VITE_FIREBASE_AUTH_DOMAIN || 'capingo-e2e.firebaseapp.com',
  VITE_FIREBASE_PROJECT_ID: process.env.VITE_FIREBASE_PROJECT_ID || 'capingo-e2e',
  VITE_FIREBASE_STORAGE_BUCKET: process.env.VITE_FIREBASE_STORAGE_BUCKET || 'capingo-e2e.appspot.com',
  VITE_FIREBASE_MESSAGING_SENDER_ID: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '123456789012',
  VITE_FIREBASE_APP_ID: process.env.VITE_FIREBASE_APP_ID || '1:123456789012:web:abcdef123456',
};

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'signed-in',
      testIgnore: /auth-form\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:5173' },
    },
    {
      name: 'login-form',
      testMatch: /auth-form\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:5174' },
    },
  ],
  webServer: [
    {
      command: 'npm run dev -- --host 127.0.0.1 --port 5173',
      url: 'http://127.0.0.1:5173',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        ...process.env,
        ...firebaseEnv,
        VITE_E2E_BYPASS_AUTH: '1',
        VITE_E2E_UID: 'e2e-tester',
        VITE_E2E_NAME: 'E2E Tester',
        VITE_E2E_EMAIL: 'e2e@capingo.test',
        VITE_API_URL: 'http://127.0.0.1:5999',
      },
    },
    {
      command: 'npm run dev -- --host 127.0.0.1 --port 5174',
      url: 'http://127.0.0.1:5174',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        ...process.env,
        ...firebaseEnv,
        VITE_E2E_BYPASS_AUTH: '0',
        VITE_API_URL: 'http://127.0.0.1:5999',
      },
    },
  ],
});

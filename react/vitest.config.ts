import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['app/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['app/utils/sm2.ts', 'app/utils/achievements.ts', 'app/utils/achievementCheck.ts'],
      exclude: ['**/*.test.ts'],
    },
  },
});

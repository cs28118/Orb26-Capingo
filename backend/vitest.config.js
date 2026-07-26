import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
    setupFiles: ['tests/setup.js'],
    fileParallelism: false,
    pool: 'forks',
    testTimeout: 60000,
    hookTimeout: 60000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: [
        'utils/**/*.js',
        'models/room.js',
        'models/studyPartnership.js',
        'routes/rooms.js',
        'routes/partners.js',
        'routes/decks.js',
        'routes/timetable.js',
        'routes/profile.js',
      ],
    },
  },
});

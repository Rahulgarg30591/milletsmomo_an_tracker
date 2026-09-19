import { defineConfig } from 'vitest/config';
import { TEST_DATABASE_URL } from './tests/integration/setup/testDb.js';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/integration/**/*.test.ts'],
    globalSetup: ['./tests/integration/setup/globalSetup.ts'],
    setupFiles: ['./tests/integration/setup/resetDb.ts'],
    // Each file gets its own worker, and they share one database, so they run
    // one at a time. TRUNCATE between tests would otherwise race.
    fileParallelism: false,
    env: {
      // Set before src/db/pool.ts is imported, so its own env loading — which
      // only fills in variables that are unset — leaves this alone.
      DATABASE_URL: TEST_DATABASE_URL,
      NODE_ENV: 'test',
    },
  },
});

import { defineConfig, devices } from '@playwright/test';
import { E2E_DATABASE_URL } from './e2e/dbUrl';

const FRONTEND = 'http://localhost:4173';
const BACKEND_PORT = '7075';

/**
 * Browser tests against the real stack: the built frontend, the Express API
 * and a Postgres database of their own.
 *
 * Deliberately not wired into CI — these are for development.
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: /.*\.spec\.ts/,
  // One worker: the specs share a database and a business day.
  workers: 1,
  fullyParallel: false,
  reporter: [['list']],
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: FRONTEND,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // The shop runs on phones.
    ...devices['Pixel 7'],
  },
  projects: [{ name: 'mobile-chromium' }],
  webServer: [
    {
      // The database is built first; the health check the runner waits on
      // cannot pass until it exists.
      command: `npx tsx e2e/prepareDb.ts && npx cross-env NODE_ENV=test PORT=${BACKEND_PORT} DATABASE_URL="${E2E_DATABASE_URL}" ALLOWED_ORIGINS="${FRONTEND}" npx tsx apps/backend/src/dev-server.ts`,
      url: `http://localhost:${BACKEND_PORT}/api/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    {
      command: `npx cross-env VITE_API_PROXY=http://localhost:${BACKEND_PORT} vite preview --port 4173 --strictPort --host 127.0.0.1`,
      cwd: 'apps/frontend',
      url: FRONTEND,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});

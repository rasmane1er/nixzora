import { defineConfig, devices } from '@playwright/test';

/**
 * Browser tests for the storefront. They need PostgreSQL and Redis running, migrations applied
 * and the demo catalog seeded (pnpm db:up, prisma:deploy, db:seed), plus built apps (pnpm build).
 * The API and storefront are started here unless they are already running.
 */
const API = 'http://localhost:4000';
const WEB = 'http://localhost:3000';

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: WEB,
    trace: 'retain-on-failure',
    ...devices['Desktop Chrome'],
    // Lets environments with a preinstalled Chromium skip "playwright install".
    launchOptions: process.env.PW_CHROMIUM_PATH
      ? { executablePath: process.env.PW_CHROMIUM_PATH }
      : {},
  },
  webServer: [
    {
      command: 'node dist/main.js',
      // Runs in apps/api so its .env (local) is picked up; CI passes the variables directly.
      cwd: '../api',
      url: `${API}/api/v1/health`,
      reuseExistingServer: !process.env.CI,
      env: { RATE_LIMIT_ENABLED: 'false', PAYMENTS_PROVIDER: 'fake', LOG_LEVEL: 'warn' },
      timeout: 60_000,
    },
    {
      command: 'pnpm start',
      url: WEB,
      reuseExistingServer: !process.env.CI,
      env: { API_URL: API, NODE_ENV: 'production' },
      timeout: 60_000,
    },
  ],
});

import { defineConfig, devices } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Browser tests for the Admin, Vehicle Owner and Customer web panels. Each run starts the compiled backend on its own
// port with a fresh throwaway database (tests/web/support/server.js); it never touches apps/backend/portal.db or any
// real environment. Artifacts (traces/screenshots on failure) are written to the same temp folder, outside the repo.
const port = Number(process.env.SAFAR_PW_PORT || 3100);
process.env.SAFAR_PW_PORT = String(port);
process.env.SAFAR_PW_DIR ||= mkdtempSync(join(tmpdir(), 'safar-playwright-'));

export default defineConfig({
  testDir: 'tests/web',
  // One worker: tests share one seeded database and the API's per-IP rate limits.
  workers: 1,
  fullyParallel: false,
  retries: 0,
  forbidOnly: !!process.env.CI,
  reporter: [['list']],
  outputDir: join(process.env.SAFAR_PW_DIR, 'artifacts'),
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    { name: 'chromium', use: { ...devices['Desktop Chrome'] }, dependencies: ['setup'], testIgnore: /auth\.setup\.ts/ },
  ],
  webServer: {
    command: 'node tests/web/support/server.js',
    url: `http://127.0.0.1:${port}/api`,
    reuseExistingServer: false,
    timeout: 120_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});

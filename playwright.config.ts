import { defineConfig, devices } from '@playwright/test';

// BASE_URL points the tests at a deployed site (e.g. https://dev.danielng.info).
// Without it, the tests run against `astro preview` of the local dist/ build.
const baseURL = process.env.BASE_URL ?? 'http://localhost:4321';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL,
    trace: 'retain-on-failure',
  },
  // Visual baselines are captured fresh on every run (see tests/run-visual.mjs),
  // so they never go stale and always come from the same machine as the candidate.
  snapshotPathTemplate: `${process.env.VISUAL_SNAPSHOT_DIR ?? '.visual-baseline'}/{arg}{ext}`,
  expect: {
    toHaveScreenshot: { animations: 'disabled', maxDiffPixelRatio: 0.001 },
  },
  projects: [
    { name: 'smoke', testMatch: /smoke\.spec\.ts/, use: { ...devices['Desktop Chrome'] } },
    { name: 'visual', testMatch: /visual\.spec\.ts/, use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: process.env.BASE_URL
    ? undefined
    : { command: 'npm run preview', url: baseURL, reuseExistingServer: !process.env.CI },
});

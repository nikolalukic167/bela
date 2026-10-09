import { defineConfig, devices } from '@playwright/test';

// Run through scripts/e2e.sh (`npm run e2e`), which starts the local Convex backend and builds.
export default defineConfig({
  testDir: 'e2e',
  timeout: 4 * 60_000,
  workers: 1,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: { baseURL: 'http://localhost:4173/bela/', trace: 'retain-on-failure' },
  webServer: { command: 'npx vite preview --port 4173 --strictPort', url: 'http://localhost:4173/bela/', reuseExistingServer: !process.env.CI },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});

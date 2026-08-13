import { defineConfig } from '@playwright/test'

const port = process.env.PORT || '3022'
const baseURL = process.env.STAGING_BASE_URL || `http://localhost:${port}`

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [['list']],
  use: {
    baseURL,
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev:staging',
    url: baseURL,
    reuseExistingServer: true,
    timeout: 180_000,
  },
})

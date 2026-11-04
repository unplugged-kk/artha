import { defineConfig, devices } from '@playwright/test';
import base from './playwright.config';

// Runs the whole suite against an already running stack (native install or any
// URL) instead of starting docker-compose.e2e.yml, Chromium only, one worker.
//   BASE_URL=http://localhost:3000 CHROMIUM_PATH=/path/to/chrome \
//     npx playwright test --config playwright.local.config.ts
const executablePath = process.env.CHROMIUM_PATH || undefined;

export default defineConfig({
  ...base,
  workers: 1,
  retries: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  webServer: undefined,
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], launchOptions: { executablePath } },
    },
  ],
});

import { defineConfig, devices, type PlaywrightTestConfig } from '@playwright/test';

process.env.NEXT_PUBLIC_FIXTURE = process.env.NEXT_PUBLIC_FIXTURE || '1';
process.env.NEXT_PUBLIC_API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://127.0.0.1:3000/api/__fixtures__/backend';

const isCI = !!process.env.CI;
const devServerCommand =
  'node ./node_modules/next/dist/bin/next dev --hostname 0.0.0.0 --port 3000';
const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';

const webServerConfig: PlaywrightTestConfig['webServer'] = process.env.PLAYWRIGHT_BASE_URL
  ? undefined
  : {
      command: devServerCommand,
      url: 'http://127.0.0.1:3000',
      reuseExistingServer: !isCI,
      timeout: 120 * 1000,
      env: {
        NEXT_PUBLIC_FIXTURE: '1',
        NEXT_PUBLIC_API_BASE: 'http://127.0.0.1:3000/api/__fixtures__/backend',
      },
    };

export default defineConfig({
  testDir: './tests',
  timeout: 30 * 1000,
  expect: {
    timeout: 5000,
  },
  fullyParallel: true,
  retries: isCI ? 2 : 0,
  workers: isCI ? 1 : undefined,
  reporter: isCI
    ? [
        ['dot'],
        ['github'],
        ['html', { outputFolder: 'playwright-report', open: 'never' }],
      ]
    : [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  grep: new RegExp(process.env.PLAYWRIGHT_GREP ?? ''),
  use: {
    actionTimeout: 0,
    trace: isCI ? 'retain-on-failure' : 'on-first-retry',
    baseURL,
    video: isCI ? 'on-first-retry' : 'retain-on-failure',
    storageState: process.env.PLAYWRIGHT_STORAGE_STATE || undefined,
  },
  webServer: webServerConfig,
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],
});

import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './specs',
  outputDir: '/artifacts/testbed/test-results',
  retries: 0,
  workers: 1,
  forbidOnly: true,
  reporter: [
    ['list'],
    ['json', { outputFile: '/artifacts/testbed/results.json' }],
    ['html', { outputFolder: '/artifacts/testbed/report', open: 'never' }],
  ],
  use: {
    browserName: 'chromium',
    baseURL: 'http://127.0.0.1:4173',
    locale: 'en-GB',
    timezoneId: 'UTC',
    colorScheme: 'light',
    reducedMotion: 'reduce',
    deviceScaleFactor: 1,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1280, height: 800 } } },
    { name: 'mobile', use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ],
  webServer: {
    command: 'node serve.mjs',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: false,
  },
});

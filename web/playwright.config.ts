import { defineConfig } from '@playwright/test';

const port = 4173;

export default defineConfig({
  testDir: 'e2e',
  outputDir: 'e2e/results',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never', outputFolder: 'e2e/report' }]] : 'list',
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    browserName: 'chromium',
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `npm run build && npx vite preview --port ${port} --strictPort`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: { VITE_API_URL: `http://127.0.0.1:${port}/api` },
  },
});

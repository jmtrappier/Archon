import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for TRAXIS E2E tests
 */
export default defineConfig({
  testDir: './tests/e2e',

  // Maximum time one test can run for
  timeout: 30 * 1000,

  // Maximum time entire test suite can run
  globalTimeout: 60 * 60 * 1000, // 1 hour

  // Test execution settings
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,

  // Reporter configuration
  reporter: [
    ['html', {
      outputFolder: 'test-results/html',
      open: 'never',
      host: 'localhost',
      port: 9323
    }],
    ['json', { outputFile: 'test-results/results.json' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
    ['list'],
    ['./tests/reporters/custom-reporter.ts']
  ],

  // Shared settings for all projects
  use: {
    // Base URL for the application
    baseURL: process.env.BASE_URL || 'http://localhost:3737',

    // Collect trace on first retry
    trace: 'on-first-retry',

    // Screenshot on failure
    screenshot: 'only-on-failure',

    // Video on failure
    video: 'retain-on-failure',

    // Viewport
    viewport: { width: 1280, height: 720 },

    // Action timeout
    actionTimeout: 10 * 1000,

    // Navigation timeout
    navigationTimeout: 30 * 1000,
  },

  // Configure projects for major browsers
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
    // Mobile viewports
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },
  ],

  // Run local dev server before starting tests
  webServer: [
    {
      command: 'cd archon-ui-main && npm run dev',
      port: 3737,
      timeout: 120 * 1000,
      reuseExistingServer: !process.env.CI,
      env: {
        PORT: '3737',
        ARCHON_UI_PORT: '3737'
      }
    },
    {
      command: 'cd python && uv run python -m server.main',
      port: 8181,
      timeout: 120 * 1000,
      reuseExistingServer: !process.env.CI,
      env: {
        PYTHONPATH: '/home/jmtrappier/Archon/python/src'
      }
    }
  ],
});
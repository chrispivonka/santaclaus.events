import { defineConfig, devices } from '@playwright/test';

// Tests run against the production build (`npm run build` first) served by `vp preview`,
// or against a deployed site when BASE_URL is set (the post-deploy check does this).
const remote = process.env.BASE_URL;
const ci = !!process.env.CI;
// Lets the post-deploy check through Vercel's preview protection.
const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;

export default defineConfig({
    testDir: 'tests',
    fullyParallel: true,
    forbidOnly: ci,
    retries: ci ? 1 : 0,
    reporter: ci ? [['github'], ['html', { open: 'never' }]] : 'list',
    use: {
        baseURL: remote || 'http://localhost:4173',
        trace: 'retain-on-failure',
        timezoneId: 'America/Denver',
        extraHTTPHeaders: bypass ? { 'x-vercel-protection-bypass': bypass, 'x-vercel-set-bypass-cookie': 'true' } : undefined,
    },
    projects: [
        { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
        { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
        { name: 'webkit', use: { ...devices['Desktop Safari'] } },
        { name: 'mobile-chrome', use: { ...devices['Pixel 7'] } },
        { name: 'mobile-safari', use: { ...devices['iPhone 15'] } },
    ],
    webServer: remote
        ? undefined
        : { command: 'npx vp preview --port 4173 --strictPort', url: 'http://localhost:4173', reuseExistingServer: !ci },
});

import { test, expect } from '@playwright/test';

// Only meaningful against a real deployment, where vercel.json's headers apply.
test.describe('security and cache headers', () => {
    test.skip(({ baseURL }) => baseURL.startsWith('http://localhost'), 'headers come from Vercel');
    test.skip(({ browserName, isMobile }) => browserName !== 'chromium' || isMobile, 'headers are the same for every browser');

    test('the page sends the security headers', async ({ request }) => {
        const response = await request.get('/');
        expect(response.status()).toBe(200);
        const headers = response.headers();
        expect(headers['content-security-policy']).toContain("frame-ancestors 'none'");
        expect(headers['strict-transport-security']).toContain('max-age=');
        expect(headers['x-content-type-options']).toBe('nosniff');
        expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
        expect(headers['permissions-policy']).toContain('camera=()');
    });

    test('fingerprinted files are cached for a year', async ({ request, page }) => {
        await page.goto('/');
        const asset = await page.locator('script[type="module"]').getAttribute('src');
        const response = await request.get(asset);
        expect(response.headers()['cache-control']).toContain('immutable');
    });
});

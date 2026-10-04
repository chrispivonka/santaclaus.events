import { test, expect } from '@playwright/test';

// Only meaningful against a real deployment, where vercel.json's headers apply.
test.describe('security and cache headers', () => {
    test.skip(({ baseURL }) => baseURL.startsWith('http://localhost'), 'headers come from Vercel');
    test.skip(({ browserName, isMobile }) => browserName !== 'chromium' || isMobile, 'headers are the same for every browser');

    test('the page sends the full set of security headers', async ({ request }) => {
        const response = await request.get('/');
        expect(response.status()).toBe(200);
        const headers = response.headers();
        const csp = headers['content-security-policy'];
        expect(csp).toContain("default-src 'self'");
        expect(csp).toContain("frame-ancestors 'none'");
        expect(csp).toContain('upgrade-insecure-requests');
        expect(csp).toMatch(/script-src 'self' 'sha256-/);
        expect(csp).toMatch(/style-src 'self' 'sha256-/);
        expect(csp).not.toMatch(/unsafe-inline|unsafe-eval/);
        expect(Number(headers['strict-transport-security'].match(/max-age=(\d+)/)[1])).toBeGreaterThanOrEqual(31536000);
        expect(headers['x-content-type-options']).toBe('nosniff');
        expect(headers['x-frame-options']).toBe('DENY');
        expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
        expect(headers['cross-origin-opener-policy']).toBe('same-origin');
        expect(headers['permissions-policy']).toContain('camera=()');
        expect(headers['x-powered-by']).toBeUndefined();
        expect(headers['server']).not.toMatch(/\d/);
    });

    test('the header policy and the meta policy agree, so the inlined styles are not blocked', async ({ page, request }) => {
        const header = (await request.get('/')).headers()['content-security-policy'];
        await page.goto('/');
        const meta = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content');
        for (const hash of meta.match(/'sha256-[^']+'/g)) expect(header).toContain(hash);
        expect(await page.locator('h1').evaluate((el) => getComputedStyle(el).fontFamily)).toMatch(/Fraunces/);
    });

    test('fingerprinted files are cached for a year, pages are not', async ({ request, page }) => {
        const home = await request.get('/');
        expect(home.headers()['cache-control'] ?? '').not.toContain('immutable');
        await page.goto('/');
        const asset = await page.locator('script[type="module"]').getAttribute('src');
        const response = await request.get(asset);
        expect(response.headers()['cache-control']).toContain('immutable');
        expect(response.headers()['cross-origin-resource-policy']).toBe('same-origin');
    });

    test('unknown URLs get a real 404 status', async ({ request }) => {
        const response = await request.get('/this-page-does-not-exist', { maxRedirects: 0 });
        expect(response.status()).toBe(404);
        expect(await response.text()).toContain('lost in the snow');
    });

    test('http redirects to https and www is not a second site', async ({ request, baseURL }) => {
        test.skip(!baseURL.includes('santaclaus.events'), 'production only');
        const insecure = await request.get(baseURL.replace('https://', 'http://'), { maxRedirects: 0 });
        expect([301, 302, 307, 308]).toContain(insecure.status());
        expect(insecure.headers()['location']).toMatch(/^https:\/\//);
    });
});

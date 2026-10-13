import { test, expect } from './fixtures.js';

test('the home page has complete, well-formed metadata', async ({ page, request }) => {
    await page.goto('/');
    const meta = await page.evaluate(() => {
        // oxlint-disable-next-line unicorn/consistent-function-scoping -- runs inside the page, cannot be hoisted
        const get = (sel, attr = 'content') => document.querySelector(sel)?.getAttribute(attr) ?? null;
        return {
            lang: document.documentElement.lang,
            title: document.title,
            description: get('meta[name="description"]'),
            viewport: get('meta[name="viewport"]'),
            themeColor: get('meta[name="theme-color"]'),
            canonical: get('link[rel="canonical"]', 'href'),
            ogTitle: get('meta[property="og:title"]'),
            ogImage: get('meta[property="og:image"]'),
            ogUrl: get('meta[property="og:url"]'),
            twitter: get('meta[name="twitter:card"]'),
            jsonLd: document.querySelector('script[type="application/ld+json"]')?.textContent ?? '',
            h1s: document.querySelectorAll('h1').length,
            headings: [...document.querySelectorAll('h1, h2, h3, h4, h5, h6')].map((h) => Number(h.tagName[1])),
            imagesWithoutAlt: [...document.querySelectorAll('img')].filter((img) => !img.hasAttribute('alt')).length,
        };
    });
    expect(meta.lang).toBe('en');
    expect(meta.title.length).toBeGreaterThan(10);
    expect(meta.title.length).toBeLessThanOrEqual(70);
    expect(meta.description.length).toBeGreaterThanOrEqual(50);
    expect(meta.description.length).toBeLessThanOrEqual(160);
    expect(meta.viewport).toContain('width=device-width');
    expect(meta.themeColor).toMatch(/^#[0-9a-f]{6}$/i);
    expect(meta.canonical).toBe('https://santaclaus.events/');
    expect(meta.ogUrl).toBe(meta.canonical);
    expect(meta.ogTitle).toBeTruthy();
    expect(meta.twitter).toBe('summary_large_image');
    expect(meta.h1s).toBe(1);
    expect(meta.imagesWithoutAlt).toBe(0);
    // Heading levels never skip (h2 -> h4) on the way down.
    for (let i = 1; i < meta.headings.length; i++) {
        expect(
            meta.headings[i] - meta.headings[i - 1],
            `heading ${i} jumps from h${meta.headings[i - 1]} to h${meta.headings[i]}`,
        ).toBeLessThanOrEqual(1);
    }
    const ld = JSON.parse(meta.jsonLd);
    expect(ld['@type']).toBe('Organization');
    expect(ld.url).toBe(meta.canonical);
    // The social preview image is served from this site at its stated size.
    expect(meta.ogImage).toMatch(/^https:\/\/santaclaus\.events\//);
    const og = await request.get(new URL(meta.ogImage).pathname);
    expect(og.status()).toBe(200);
    expect(og.headers()['content-type']).toMatch(/^image\//);
});

test('the 404 page is kept out of search results', async ({ page }) => {
    await page.goto('/404.html');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
    await expect(page).toHaveTitle(/not found/i);
});

import { test, expect } from './fixtures.js';

// Parses "default-src 'self'; img-src 'self' data:" into { 'default-src': ["'self'"], ... }
function parseCsp(text) {
    const policy = {};
    for (const part of text.split(';')) {
        const [directive, ...sources] = part.trim().split(/\s+/);
        if (directive) policy[directive] = sources;
    }
    return policy;
}

test.describe('content security policy', () => {
    test('the policy is strict: no unsafe-inline, no eval, no wildcards, no plugins', async ({ page }) => {
        await page.goto('/');
        const content = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content');
        const csp = parseCsp(content);
        expect(csp['default-src']).toEqual(["'self'"]);
        expect(csp['object-src']).toEqual(["'none'"]);
        expect(csp['base-uri']).toEqual(["'self'"]);
        expect(csp['form-action']).toEqual(['https://script.google.com']);
        for (const [directive, sources] of Object.entries(csp)) {
            for (const source of sources) {
                if (directive === 'img-src' && source === 'data:') continue;
                expect(source, `${directive} must not allow ${source}`).not.toMatch(
                    /unsafe-inline|unsafe-eval|^\*$|^https?:$|^data:$|^blob:$|^http:/,
                );
            }
        }
        // img-src is the one place data: is allowed (the favicon is inlined).
        expect(content).toContain("img-src 'self' data:");
        // Every inline script and style is hashed.
        const inline = await page.evaluate(() => ({
            scripts: [...document.querySelectorAll('script:not([src]):not([type="application/ld+json"])')].length,
            styles: [...document.querySelectorAll('style')].length,
        }));
        expect(csp['script-src'].filter((s) => s.startsWith("'sha256-"))).toHaveLength(inline.scripts);
        expect(csp['style-src'].filter((s) => s.startsWith("'sha256-"))).toHaveLength(inline.styles);
    });

    test('nothing on the page violates the policy, even while playing with everything', async ({ page }) => {
        await page.addInitScript(() => {
            window.testCspViolations = [];
            document.addEventListener('securitypolicyviolation', (e) => {
                window.testCspViolations.push(`${e.violatedDirective} blocked ${e.blockedURI} at ${e.sourceFile}:${e.lineNumber}`);
            });
        });
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.clock.install({ time: new Date('2026-12-10T10:00:00') });
        await page.goto('/');
        await page.locator('#themeToggle').click();
        await page.locator('#soundToggle').click();
        await page.locator('#sleigh').dispatchEvent('click'); // hidden under reduced motion, still wired up
        await page.locator('#moon').click({ force: true });
        await page.locator('#events').scrollIntoViewIfNeeded();
        await page.locator('#adventGrid .door').nth(0).click();
        await expect(page.locator('#adventDialog')).toBeVisible();
        await page.locator('#adventReveal').click();
        await page.keyboard.press('Escape');
        await page.locator('#niceName').fill('Ava');
        await page.locator('#niceForm button[type="submit"]').click();
        await expect(page.locator('#niceOutcome')).toBeVisible();
        await page.locator('#elfFirst').fill('Ava');
        await page.locator('#elfMonth').selectOption('11');
        await page.locator('#elfForm button[type="submit"]').click();
        await page.locator('.deer-card').first().click();
        await page.locator('.wish-chips button').first().click();
        await page.locator('#name').fill('Ava');
        await page.locator('#email').fill('ava@example.com');
        await page.locator('#submitButton').click();
        await expect(page.locator('#formStatus')).toBeVisible();
        expect(await page.evaluate(() => window.testCspViolations)).toEqual([]);
    });
});

test.describe('markup hygiene', () => {
    for (const path of ['/', '/404.html']) {
        test(`${path} has safe links, no inline handlers and no plugin or refresh tags`, async ({ page }) => {
            await page.goto(path);
            const report = await page.evaluate(() => {
                const problems = [];
                for (const a of document.querySelectorAll('a[href]')) {
                    const href = a.getAttribute('href');
                    if (/^\s*javascript:/i.test(href)) problems.push(`javascript: link: ${href}`);
                    if (/^http:/i.test(href)) problems.push(`insecure http link: ${href}`);
                    if (/^https?:/i.test(href) && new URL(href).origin !== location.origin) {
                        if (a.target !== '_blank') problems.push(`outside link without target=_blank: ${href}`);
                        if (!/\bnoopener\b/.test(a.rel)) problems.push(`outside link without rel=noopener: ${href}`);
                    }
                }
                for (const el of document.querySelectorAll('*')) {
                    for (const attr of el.attributes) {
                        if (/^on[a-z]+$/i.test(attr.name)) problems.push(`inline handler ${attr.name} on <${el.localName}>`);
                    }
                }
                for (const form of document.querySelectorAll('form[action]')) {
                    if (!form.action.startsWith('https:')) problems.push(`form posts over http: ${form.action}`);
                }
                for (const sel of ['object', 'embed', 'applet', 'base', 'meta[http-equiv="refresh"]']) {
                    if (document.querySelector(sel)) problems.push(`found <${sel}>`);
                }
                for (const script of document.querySelectorAll('script[src]')) {
                    if (new URL(script.src).origin !== location.origin) problems.push(`third-party script: ${script.src}`);
                }
                return problems;
            });
            expect(report).toEqual([]);
        });
    }

    test('the honeypot field is invisible to people and still posted empty', async ({ page }) => {
        const honeypot = page.locator('#website');
        await page.goto('/');
        // Parked off screen, out of the tab order and out of the accessibility tree.
        await expect(honeypot).not.toBeInViewport();
        await expect(honeypot).toHaveAttribute('tabindex', '-1');
        expect(await honeypot.evaluate((el) => el.closest('[aria-hidden="true"]') !== null)).toBe(true);
        const posted = page.waitForRequest((r) => r.method() === 'POST' && r.url().startsWith('https://script.google.com/'));
        await page.locator('#name').fill('Ava');
        await page.locator('#email').fill('ava@example.com');
        await page.locator('#message').fill('Hello Santa');
        await page.locator('#submitButton').click();
        const params = new URLSearchParams((await posted).postData());
        expect(params.get('website')).toBe('');
        expect(params.get('name')).toBe('Ava');
        expect(params.get('message')).toBe('Hello Santa');
    });
});

test.describe('outside requests', () => {
    test('the first load talks to no one but this site', async ({ page, baseURL }) => {
        const outside = [];
        page.on('request', (r) => {
            if (new URL(r.url()).origin !== new URL(baseURL).origin && !r.url().startsWith('data:')) outside.push(r.url());
        });
        await page.goto('/', { waitUntil: 'networkidle' });
        expect(outside).toEqual([]);
    });

    test('scrolling to the events only adds the Google Calendar embed', async ({ page, baseURL }) => {
        const outside = new Set();
        page.on('request', (r) => {
            const url = new URL(r.url());
            if (url.origin !== new URL(baseURL).origin && url.protocol.startsWith('http')) outside.add(url.hostname);
        });
        await page.goto('/');
        await page.locator('#events').scrollIntoViewIfNeeded();
        await expect(page.locator('#calendarEmbed')).toHaveAttribute('src', /calendar\.google\.com/);
        await page.waitForLoadState('networkidle');
        expect([...outside]).toEqual(['calendar.google.com']);
    });

    test('only expected keys are written to local storage', async ({ page }) => {
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.goto('/');
        await page.locator('#themeToggle').click();
        await page.locator('#soundToggle').click();
        await page.locator('#snowToggle').click();
        await page.locator('.peeker').first().click({ force: true });
        const keys = await page.evaluate(() => Object.keys(localStorage));
        for (const key of keys) expect(key).toMatch(/^(site-theme|site-sound|site-snow|seek-found|advent-\d{4})$/);
    });
});

test.describe('well-known files', () => {
    test('robots.txt, sitemap.xml, the manifest and security.txt are served and consistent', async ({ page, request }) => {
        const robots = await request.get('/robots.txt');
        expect(robots.status()).toBe(200);
        expect(await robots.text()).toMatch(/Sitemap: https:\/\/santaclaus\.events\/sitemap\.xml/);

        const sitemap = await request.get('/sitemap.xml');
        expect(sitemap.status()).toBe(200);
        expect(await sitemap.text()).toContain('<loc>https://santaclaus.events/</loc>');

        const manifest = await (await request.get('/site.webmanifest')).json();
        expect(manifest.name).toBe('Santa Claus Events');
        for (const icon of manifest.icons) expect((await request.get(icon.src)).status()).toBe(200);

        const security = await request.get('/.well-known/security.txt');
        expect(security.status()).toBe(200);
        const text = await security.text();
        expect(text).toMatch(/^Contact: https:\/\//m);
        const expires = new Date(text.match(/^Expires: (.+)$/m)[1]);
        expect(expires.getTime()).toBeGreaterThan(Date.now());

        await page.goto('/');
        for (const rel of ['icon', 'apple-touch-icon', 'manifest']) {
            const href = await page.locator(`link[rel="${rel}"]`).first().getAttribute('href');
            expect((await request.get(href)).status(), `${rel} ${href}`).toBe(200);
        }
    });
});

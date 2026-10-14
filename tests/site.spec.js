import { test, expect } from './fixtures.js';

test.describe('home page', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
    });

    test('has the title, main heading and hero photo', async ({ page }) => {
        await expect(page).toHaveTitle(/Santa Claus Events/);
        await expect(page.getByRole('heading', { level: 1 })).toContainText('Hello from');
        const hero = page.locator('.photo-frame img');
        await expect(hero).toBeVisible();
        await expect.poll(() => hero.evaluate((img) => img.complete && img.naturalWidth > 0)).toBe(true);
    });

    test('loads the self-hosted fonts', async ({ page }) => {
        const families = await page.evaluate(async () => {
            await document.fonts.ready;
            return [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family.replace(/"/g, ''));
        });
        expect(families).toEqual(expect.arrayContaining(['Inter', 'Fraunces']));
    });

    test('counts down to Christmas', async ({ page }) => {
        await expect(page.locator('[data-unit="days"]')).toHaveText(/^\d+$/);
    });

    test('switches between dark and light themes and remembers the choice', async ({ page }) => {
        const html = page.locator('html');
        const start = await html.getAttribute('data-theme');
        const other = start === 'dark' ? 'light' : 'dark';
        await page.locator('#themeToggle').click();
        await expect(html).toHaveAttribute('data-theme', other);
        await page.reload();
        await expect(html).toHaveAttribute('data-theme', other);
    });

    test('loads the events calendar only when it scrolls near, in the visitor time zone', async ({ page }) => {
        const calendar = page.locator('#calendarEmbed');
        await expect(calendar).not.toHaveAttribute('src', /./);
        await page.locator('#events').scrollIntoViewIfNeeded();
        await expect(calendar).toHaveAttribute('src', /ctz=America%2FDenver/);
    });

    test('hero links lead to events, the letter, private events and photo shoots', async ({ page }) => {
        const targets = {
            'See where Santa will be': '#events',
            'Write Santa a letter': '#letter',
            'Schedule a private event': '#private-events',
            'Schedule a photo shoot': '#photo-shoots',
        };
        for (const [name, href] of Object.entries(targets)) {
            await expect(page.locator('.hero').getByRole('link', { name })).toHaveAttribute('href', href);
        }
        await page.locator('.hero').getByRole('link', { name: 'Schedule a photo shoot' }).click();
        await expect(page).toHaveURL(/#photo-shoots$/);
        await expect(page.getByRole('heading', { name: 'Schedule a photo shoot' })).toBeInViewport();
    });

    test('the photo shoot card lists Written In Light, and private events wait on their own contact', async ({ page }) => {
        const privateEvents = page.locator('#private-events');
        await expect(privateEvents.getByText('TBD')).toHaveCount(2);
        await expect(privateEvents.getByRole('link', { name: 'Message Santa on Facebook' })).toBeVisible();
        const photos = page.locator('#photo-shoots');
        await expect(photos.locator('a[href^="tel:"]')).toHaveCount(2);
        await expect(photos.locator('a[href^="mailto:"]')).toHaveCount(1);
        await expect(page.locator('#contact')).not.toContainText(/home/i);
    });

    test('mentions Cody, WY and thanks the Cody Rotary Club', async ({ page }) => {
        await expect(page.locator('.lede')).toContainText('Cody, Wyoming');
        await expect(page.locator('.site-footer')).toContainText('Cody, WY');
        await expect(page.locator('#about')).toContainText('Cody Rotary Club');
    });

    test('letter form shows errors for empty fields, then sends', async ({ page }) => {
        const form = page.locator('#letterForm');
        await form.scrollIntoViewIfNeeded();
        await page.locator('#submitButton').click();
        await expect(page.locator('#name')).toHaveAttribute('aria-invalid', 'true');
        await expect(page.locator('#name')).toBeFocused();

        await page.locator('#name').fill('Test Elf');
        await page.locator('#email').fill('elf@example.com');
        await page.locator('#message').fill('A sled, please.');
        await page.locator('#submitButton').click();
        const status = page.locator('#formStatus');
        await expect(status).toBeVisible();
        await expect(status).not.toHaveClass(/is-error/);
    });
});

test('mobile menu opens and closes', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'the menu button only shows on small screens');
    await page.goto('/');
    const toggle = page.locator('#navToggle');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('#navLinks')).toBeVisible();
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
});

test.describe(() => {
    // Chromium logs the 404 status of the page itself as a console error.
    test.use({ allowedErrors: [/status of 404/] });

    test('404 page', async ({ page, baseURL }) => {
        // Locally `vp preview` falls back to index.html, so request the page directly;
        // on a real deployment, check that unknown URLs get the 404 page and status.
        const remote = !baseURL.startsWith('http://localhost');
        const response = await page.goto(remote ? '/this-page-does-not-exist' : '/404.html');
        if (remote) expect(response.status()).toBe(404);
        await expect(page.getByRole('heading', { level: 1 })).toHaveText('This page got lost in the snow');
        await expect(page.getByRole('link', { name: /home|back/i }).first()).toBeVisible();
    });
});

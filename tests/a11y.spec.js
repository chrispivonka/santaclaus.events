import AxeBuilder from '@axe-core/playwright';
import { test, expect } from './fixtures.js';

// axe-core checks against WCAG 2.2 A and AA plus axe best practices, in both color themes,
// on the pages as they load and in every interactive state the page can be in.
const tags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'];

async function checkA11y(page, label) {
    const results = await new AxeBuilder({ page }).withTags(tags).exclude('#calendarEmbed').analyze();
    expect(
        results.violations.map((v) => `${v.id} (${v.impact}): ${v.help} on ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
        label,
    ).toEqual([]);
}

async function revealAll(page) {
    await page.evaluate(() => document.querySelectorAll('.reveal').forEach((el) => el.classList.add('in')));
}

for (const theme of ['dark', 'light']) {
    test.describe(`${theme} theme`, () => {
        test.beforeEach(async ({ page }) => {
            await page.addInitScript((t) => localStorage.setItem('site-theme', t), theme);
            await page.emulateMedia({ reducedMotion: 'reduce' });
        });

        test(`home page has no violations @a11y`, async ({ page }) => {
            await page.goto('/');
            await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
            await revealAll(page);
            await checkA11y(page, 'as loaded');
        });

        test(`404 page has no violations @a11y`, async ({ page }) => {
            await page.goto('/404.html');
            await checkA11y(page, '404');
        });

        test(`every interactive state has no violations @a11y`, async ({ page, isMobile }) => {
            await page.clock.install({ time: new Date('2026-12-10T10:00:00') });
            await page.goto('/');
            await revealAll(page);

            if (isMobile) {
                await page.locator('#navToggle').click();
                await expect(page.locator('#navLinks')).toBeVisible();
                await checkA11y(page, 'menu open');
                await page.locator('#navToggle').click();
            }

            await page.locator('#adventGrid .door').nth(0).click();
            await expect(page.locator('#adventDialog')).toBeVisible();
            await checkA11y(page, 'advent dialog open');
            await page.locator('#adventReveal').click();
            await checkA11y(page, 'joke answer shown');
            await page.keyboard.press('Escape');

            await page.locator('#adventGrid .door').nth(20).click();
            await expect(page.locator('#toast')).toHaveClass(/show/);
            await checkA11y(page, 'toast showing');

            await page.locator('#niceName').fill('Ava');
            await page.locator('#niceForm button[type="submit"]').click();
            await expect(page.locator('#niceOutcome')).toBeVisible();
            await checkA11y(page, 'nice list result');

            await page.locator('#elfFirst').fill('Ava');
            await page.locator('#elfMonth').selectOption('5');
            await page.locator('#elfForm button[type="submit"]').click();
            await expect(page.locator('#elfBadge')).toBeVisible();
            await page.locator('.deer-card').first().click();
            await checkA11y(page, 'elf badge and flipped reindeer');

            await page.locator('#submitButton').click();
            await expect(page.locator('#name')).toHaveAttribute('aria-invalid', 'true');
            await checkA11y(page, 'letter form errors');
        });
    });
}

test('landmarks and live regions are in place', async ({ page }) => {
    await page.goto('/');
    const structure = await page.evaluate(() => ({
        main: document.querySelectorAll('main').length,
        header: document.querySelectorAll('body > header').length,
        footer: document.querySelectorAll('body > footer').length,
        navLabel: document.querySelector('nav')?.getAttribute('aria-label'),
        sectionsWithoutHeading: [...document.querySelectorAll('main > section')].filter((s) => !s.querySelector('h1, h2')).length,
        liveRegions: ['#toast', '#formStatus', '#countdown', '#niceResult', '#elfBadge'].filter(
            (id) => !document.querySelector(id)?.getAttribute('aria-live'),
        ),
        dialogLabelled: !!document.querySelector('dialog[aria-labelledby]'),
        decorativeSvgsExposed: [...document.querySelectorAll('svg:not([aria-hidden="true"])')].filter((svg) => !svg.closest('button, a'))
            .length,
    }));
    expect(structure).toEqual({
        main: 1,
        header: 1,
        footer: 1,
        navLabel: 'Main',
        sectionsWithoutHeading: 0,
        liveRegions: [],
        dialogLabelled: true,
        decorativeSvgsExposed: 0,
    });
});

test('respects reduced motion: no autoplaying snow, no hero letter animation', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await expect(page.locator('#snowToggleLabel')).toHaveText('Snow off');
    await expect(page.locator('.hero h1 .accent')).not.toHaveClass(/lettered/);
    const running = await page.evaluate(
        () =>
            new Promise((resolve) => {
                let frames = 0;
                const tick = () =>
                    ++frames < 10 ? requestAnimationFrame(tick) : resolve(document.querySelectorAll('.trail, .ltr').length);
                requestAnimationFrame(tick);
            }),
    );
    expect(running).toBe(0);
});

test('still readable in forced-colors (high contrast) mode', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'forced colors emulation is Chromium only');
    await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' });
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('link', { name: 'See where Santa will be' })).toBeVisible();
    const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa'])
        .disableRules(['color-contrast'])
        .exclude('#calendarEmbed')
        .analyze();
    expect(results.violations.map((v) => v.id)).toEqual([]);
});

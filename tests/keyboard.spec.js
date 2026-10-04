import { test, expect } from './fixtures.js';

// Everything must work with a keyboard alone, with a visible focus ring.
const focused = (page) =>
    page.evaluate(() => {
        const el = document.activeElement;
        return el
            ? `${el.localName}${el.id ? '#' + el.id : ''}${el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : ''}`
            : null;
    });

test.describe('keyboard', () => {
    test.beforeEach(async ({ page }) => {
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.goto('/');
    });

    test('the skip link is the first stop and jumps to the content', async ({ page, browserName, isMobile }) => {
        test.skip(isMobile, 'touch devices have no Tab key');
        await page.keyboard.press('Tab');
        expect(await focused(page)).toBe('a.skip-link');
        await expect(page.locator('.skip-link')).toBeInViewport();
        await page.keyboard.press('Enter');
        await expect(page).toHaveURL(/#main$/);
        if (browserName === 'chromium') {
            // The next Tab continues from the main content, not from the top of the page.
            await page.keyboard.press('Tab');
            expect(await page.evaluate(() => document.activeElement.closest('#main') !== null)).toBe(true);
        }
    });

    test('the header controls come in reading order', async ({ page, isMobile }) => {
        test.skip(isMobile, 'touch devices have no Tab key');
        const order = [];
        for (let i = 0; i < 9; i++) {
            await page.keyboard.press('Tab');
            order.push(await focused(page));
        }
        expect(order.slice(0, 4)).toEqual(['a.skip-link', 'a.brand', 'button#soundToggle.icon-btn', 'button#themeToggle.icon-btn']);
        expect(order.slice(4, 9).every((o) => o.startsWith('a'))).toBe(true);
    });

    test('keyboard focus is visible on buttons and links', async ({ page, isMobile }) => {
        test.skip(isMobile, 'touch devices have no Tab key');
        await page.keyboard.press('Tab');
        await page.keyboard.press('Tab');
        await page.keyboard.press('Tab');
        const ring = await page.evaluate(() => {
            const s = getComputedStyle(document.activeElement);
            return { style: s.outlineStyle, width: parseFloat(s.outlineWidth) };
        });
        expect(ring.style).not.toBe('none');
        expect(ring.width).toBeGreaterThanOrEqual(2);
    });

    test('an advent door opens with Enter, the dialog closes with Escape and focus returns', async ({ page }) => {
        await page.clock.install({ time: new Date('2026-12-10T10:00:00') });
        await page.reload();
        const door = page.locator('#adventGrid .door').nth(1);
        await door.focus();
        await page.keyboard.press('Enter');
        const dialog = page.locator('#adventDialog');
        await expect(dialog).toBeVisible();
        // Focus is inside the dialog, and Tab stays inside it.
        expect(await page.evaluate(() => document.activeElement.closest('#adventDialog') !== null)).toBe(true);
        for (let i = 0; i < 4; i++) await page.keyboard.press('Tab');
        expect(await page.evaluate(() => document.activeElement.closest('#adventDialog') !== null)).toBe(true);
        await page.keyboard.press('Escape');
        await expect(dialog).toBeHidden();
        await expect(door).toBeFocused();
    });

    test('toggle buttons work with Space and announce their state', async ({ page }) => {
        const card = page.locator('.deer-card').first();
        await card.focus();
        await page.keyboard.press('Space');
        await expect(card).toHaveAttribute('aria-pressed', 'true');
        await page.keyboard.press('Space');
        await expect(card).toHaveAttribute('aria-pressed', 'false');

        const sound = page.locator('#soundToggle');
        await sound.focus();
        await page.keyboard.press('Enter');
        await expect(sound).toHaveAttribute('aria-pressed', 'true');
    });

    test('the mobile menu opens from the keyboard and leads to the links', async ({ page, isMobile }) => {
        test.skip(!isMobile, 'the menu button only shows on small screens');
        const toggle = page.locator('#navToggle');
        await toggle.focus();
        await page.keyboard.press('Enter');
        await expect(toggle).toHaveAttribute('aria-expanded', 'true');
        await page.keyboard.press('Tab');
        expect(await page.evaluate(() => document.activeElement.closest('#navLinks') !== null)).toBe(true);
        await page.keyboard.press('Escape');
        await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    });

    test('the letter form can be completed and sent without a mouse', async ({ page }) => {
        await page.locator('#name').focus();
        await page.keyboard.type('Ava');
        await page.keyboard.press('Tab');
        await page.keyboard.type('ava@example.com');
        await page.keyboard.press('Tab');
        await page.keyboard.type('A sled, please.');
        await page.locator('#submitButton').focus();
        await page.keyboard.press('Enter');
        await expect(page.locator('#formStatus')).toBeVisible();
        await expect(page.locator('#formStatus')).not.toHaveClass(/is-error/);
    });
});

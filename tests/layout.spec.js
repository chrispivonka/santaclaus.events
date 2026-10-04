import { test, expect } from './fixtures.js';

const noHorizontalScroll = (page) =>
    page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
    }));

test.describe('layout', () => {
    for (const path of ['/', '/404.html']) {
        test(`${path} never scrolls sideways`, async ({ page }) => {
            await page.goto(path);
            const sizes = await noHorizontalScroll(page);
            expect(sizes.scrollWidth).toBeLessThanOrEqual(sizes.innerWidth);
        });
    }

    test('still fits a 320px-wide phone with the menu open', async ({ page }) => {
        await page.setViewportSize({ width: 320, height: 568 });
        await page.goto('/');
        await page.locator('#navToggle').click();
        await expect(page.locator('#navLinks')).toBeVisible();
        const sizes = await noHorizontalScroll(page);
        expect(sizes.scrollWidth).toBeLessThanOrEqual(sizes.innerWidth);
    });

    test('text can be enlarged to 200% without breaking the page', async ({ page }) => {
        await page.goto('/');
        // Set through the CSSOM: the page's CSP has no room for an injected <style>.
        await page.evaluate(() => (document.documentElement.style.fontSize = '200%'));
        const sizes = await noHorizontalScroll(page);
        expect(sizes.scrollWidth).toBeLessThanOrEqual(sizes.innerWidth);
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    });

    test('every visible control is at least 24 by 24 pixels (WCAG 2.2 target size)', async ({ page }) => {
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.goto('/');
        // Reveal everything so measurements are of the final layout.
        await page.evaluate(() => document.querySelectorAll('.reveal').forEach((el) => el.classList.add('in')));
        const small = await page.evaluate(() => {
            const out = [];
            for (const el of document.querySelectorAll('a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])')) {
                const style = getComputedStyle(el);
                if (style.display === 'none' || style.visibility === 'hidden' || el.closest('[hidden], [aria-hidden="true"]')) continue;
                if (el.getAttribute('tabindex') === '-1') continue;
                // Links inside a sentence are exempt from the target-size rule.
                if (el.matches('p a, li a:not(.nav-links a)') && style.display === 'inline') continue;
                const { width, height } = el.getBoundingClientRect();
                if (width === 0 && height === 0) continue;
                if (width < 24 || height < 24)
                    out.push(`${el.localName}#${el.id || el.className} ${Math.round(width)}x${Math.round(height)}`);
            }
            return out;
        });
        expect(small).toEqual([]);
    });
});

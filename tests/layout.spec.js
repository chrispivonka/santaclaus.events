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

    test('text spacing can be widened without clipping or overlap (WCAG 1.4.12)', async ({ page }) => {
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.goto('/');
        await page.evaluate(() => document.querySelectorAll('.reveal').forEach((el) => el.classList.add('in')));
        // The spacing the success criterion asks pages to survive, set through the CSSOM like above.
        const clipped = await page.evaluate(() => {
            for (const el of document.querySelectorAll('body *')) {
                el.style.lineHeight = '1.5';
                el.style.letterSpacing = '0.12em';
                el.style.wordSpacing = '0.16em';
            }
            for (const p of document.querySelectorAll('p')) p.style.marginBottom = '2em';
            const out = [];
            for (const el of document.querySelectorAll('h1, h2, h3, p, label, button, a, li')) {
                const style = getComputedStyle(el);
                if (el.closest('[hidden], [aria-hidden="true"], dialog:not([open])') || style.display === 'none') continue;
                if (!el.textContent.trim() || el.getClientRects().length === 0) continue;
                const hides = style.overflow === 'hidden' || style.overflowX === 'hidden' || style.overflowY === 'hidden';
                if (hides && (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1))
                    out.push(`${el.localName}#${el.id || el.className}: ${el.textContent.trim().slice(0, 30)}`);
            }
            return out;
        });
        expect(clipped).toEqual([]);
        const sizes = await noHorizontalScroll(page);
        expect(sizes.scrollWidth).toBeLessThanOrEqual(sizes.innerWidth);
    });

    test('a focused control is never hidden under the sticky header (WCAG 2.4.11)', async ({ page, isMobile }) => {
        test.skip(isMobile, 'Phones have no Tab key.');
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.goto('/');
        await page.evaluate(() => document.querySelectorAll('.reveal').forEach((el) => el.classList.add('in')));
        const hidden = [];
        for (let i = 0; i < 80; i++) {
            await page.keyboard.press('Tab');
            const result = await page.evaluate(() => {
                const el = document.activeElement;
                if (!el || el === document.body || el.closest('.site-header')) return null;
                const box = el.getBoundingClientRect();
                if (box.width === 0 && box.height === 0) return null;
                // Whatever is drawn on top at the middle of the control must be the control itself.
                const top = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
                return top && top.closest('.site-header') ? `${el.localName}#${el.id || el.className}` : null;
            });
            if (result) hidden.push(result);
        }
        expect(hidden).toEqual([]);
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

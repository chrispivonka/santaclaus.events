import AxeBuilder from '@axe-core/playwright';
import { test, expect } from './fixtures.js';

// axe-core checks against WCAG 2.2 A and AA, in both color themes.
const tags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'];

for (const theme of ['dark', 'light']) {
    for (const path of ['/', '/404.html']) {
        test(`${path} has no accessibility violations in ${theme} mode @a11y`, async ({ page }) => {
            await page.addInitScript((t) => localStorage.setItem('site-theme', t), theme);
            await page.emulateMedia({ reducedMotion: 'reduce' });
            await page.goto(path);
            await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
            // Reveal scroll-in sections so they're checked at full opacity.
            await page.evaluate(() => document.querySelectorAll('.reveal').forEach((el) => el.classList.add('in')));
            const results = await new AxeBuilder({ page }).withTags(tags).exclude('#calendarEmbed').analyze();
            expect(results.violations.map((v) => `${v.id}: ${v.help} (${v.nodes.length})`)).toEqual([]);
        });
    }
}

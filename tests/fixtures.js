import { test as base, expect } from '@playwright/test';

// Every test fails if the page logs an error or throws, and outside services
// (Google Calendar, the letter endpoint) are stubbed so tests are fast and repeatable.
// Messages browsers log about themselves, not about the page.
const browserNoise = [
    /Navigated away from page/, // Firefox, when a reload interrupts the Web Audio setup
];

export const test = base.extend({
    // Patterns of console errors a test expects, set with test.use({ allowedErrors: [...] }).
    allowedErrors: [[], { option: true }],
    page: async ({ page, allowedErrors }, use) => {
        const errors = [];
        page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
        page.on('console', (msg) => {
            if (msg.type() === 'error' && ![...browserNoise, ...allowedErrors].some((pattern) => pattern.test(msg.text())))
                errors.push(`console: ${msg.text()}`);
        });
        await page.route(/^https:\/\/calendar\.google\.com\//, (route) =>
            route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Calendar</title>' }),
        );
        await page.route(/^https:\/\/script\.google(usercontent)?\.com\//, (route) => route.fulfill({ status: 200, body: 'ok' }));
        await use(page);
        expect(errors, 'the page logged errors').toEqual([]);
    },
});

export { expect };

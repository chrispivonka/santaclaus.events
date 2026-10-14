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

    test('the booking cards route requests through the form, with no phone numbers or emails on the page', async ({ page }) => {
        const contact = page.locator('#contact');
        await expect(contact.locator('a[href^="tel:"], a[href^="mailto:"]')).toHaveCount(0);
        await expect(page.locator('#private-events').getByRole('button', { name: 'Request a private booking' })).toBeVisible();
        await expect(page.locator('#photo-shoots').getByRole('button', { name: 'Request a photo shoot' })).toBeVisible();
        await expect(page.locator('#photo-shoots')).toContainText('Written In Light');
        await expect(contact).not.toContainText(/\bHome\b/);
    });

    test('the private booking pop-up checks its fields, sends the request and confirms', async ({ page }) => {
        let sent;
        await page.route(/^https:\/\/script\.google\.com\//, (route) => {
            sent = new URLSearchParams(route.request().postData());
            return route.fulfill({ status: 200, body: 'ok' });
        });
        const dialog = page.locator('#bookingDialog');
        await page.getByRole('button', { name: 'Request a private booking' }).click();
        await expect(dialog).toBeVisible();
        await expect(dialog.getByRole('heading', { name: 'Private booking request' })).toBeVisible();
        await expect(page.locator('#bk-name')).toBeFocused();

        await dialog.getByRole('button', { name: 'Send my request' }).click();
        for (const id of ['bk-name', 'bk-phone', 'bk-email', 'bk-date', 'bk-type', 'bk-place', 'bk-elf', 'bk-photo'])
            await expect(page.locator(`#${id}`)).toHaveAttribute('aria-invalid', 'true');
        await expect(page.locator('#bk-name')).toBeFocused();
        expect(sent).toBeUndefined();

        await page.locator('#bk-name').fill('Jamie Frost');
        await page.locator('#bk-phone').fill('307-555-0199');
        await page.locator('#bk-email').fill('not-an-email');
        await page.locator('#bk-date').fill('2026-12-20');
        await page.locator('#bk-time').fill('18:30');
        await page.locator('#bk-type').selectOption('Home visit');
        await page.locator('#bk-place').fill('Cody');
        await page.locator('#bk-kids').fill('3');
        await page.locator('#bk-elf').selectOption('Yes, please');
        await page.locator('#bk-photo').selectOption('Yes, but only from behind (no faces)');
        await page.locator('#bk-notes').fill('Christmas Eve surprise');
        await dialog.getByRole('button', { name: 'Send my request' }).click();
        await expect(page.locator('#bk-email')).toHaveAttribute('aria-invalid', 'true');
        await expect(page.locator('#bk-email-error')).toHaveText('Please add a valid email address.');

        await page.locator('#bk-email').fill('jamie@example.com');
        await dialog.getByRole('button', { name: 'Send my request' }).click();
        await expect(page.locator('#bookingStatus')).toContainText('Your request is on its way');
        await expect(page.locator('#bookingBody')).toBeHidden();
        expect(sent.has('people')).toBe(false);
        expect(Object.fromEntries(sent)).toMatchObject({
            formType: 'private-booking',
            name: 'Jamie Frost',
            phone: '307-555-0199',
            email: 'jamie@example.com',
            date: '2026-12-20',
            time: '18:30',
            eventType: 'Home visit',
            place: 'Cody',
            kids: '3',
            elf: 'Yes, please',
            photo: 'Yes, but only from behind (no faces)',
            notes: 'Christmas Eve surprise',
            website: '',
        });

        await dialog.getByRole('button', { name: 'Close the booking request' }).click();
        await expect(dialog).toBeHidden();
        await page.getByRole('button', { name: 'Request a private booking' }).click();
        await expect(page.locator('#bookingBody')).toBeVisible();
        await expect(page.locator('#bk-name')).toHaveValue('');
    });

    test('the photo shoot request asks only what the photographers need and is sent as a photo shoot', async ({ page }) => {
        let sent;
        await page.route(/^https:\/\/script\.google\.com\//, (route) => {
            sent = new URLSearchParams(route.request().postData());
            return route.fulfill({ status: 200, body: 'ok' });
        });
        const dialog = page.locator('#bookingDialog');

        // Half-filling the private form first, then switching, starts the photo request fresh.
        await page.getByRole('button', { name: 'Request a private booking' }).click();
        await page.locator('#bk-name').fill('Someone Else');
        await dialog.getByRole('button', { name: 'Close the booking request' }).click();

        await page.getByRole('button', { name: 'Request a photo shoot' }).click();
        await expect(dialog.getByRole('heading', { name: 'Photo shoot request' })).toBeVisible();
        await expect(dialog).toContainText('Written In Light');
        await expect(page.locator('#bk-name')).toHaveValue('');
        await expect(page.getByLabel('Preferred date')).toBeVisible();
        for (const id of ['bk-type', 'bk-place', 'bk-kids', 'bk-elf', 'bk-photo']) await expect(page.locator(`#${id}`)).toBeHidden();

        await page.locator('#bk-name').fill('Jamie Frost');
        await page.locator('#bk-phone').fill('307-555-0199');
        await page.locator('#bk-email').fill('jamie@example.com');
        await page.locator('#bk-date').fill('2026-12-06');
        await page.locator('#bk-people').fill('5');
        await dialog.getByRole('button', { name: 'Send my request' }).click();
        await expect(page.locator('#bookingStatus')).toContainText('Your request is on its way');
        expect(Object.fromEntries(sent)).toMatchObject({
            formType: 'photo-shoot',
            name: 'Jamie Frost',
            phone: '307-555-0199',
            email: 'jamie@example.com',
            date: '2026-12-06',
            people: '5',
        });
        for (const key of ['eventType', 'place', 'kids', 'elf', 'photo']) expect(sent.has(key)).toBe(false);
    });

    test.describe('when the network is down', () => {
        // The browser logs the failed request; that is the one error this test expects.
        test.use({ allowedErrors: [/Failed to load resource/] });

        test('a failed booking request keeps what was typed and explains', async ({ page }) => {
            await page.route(/^https:\/\/script\.google\.com\//, (route) => route.abort('failed'));
            await page.getByRole('button', { name: 'Request a private booking' }).click();
            await page.locator('#bk-name').fill('Jamie Frost');
            await page.locator('#bk-phone').fill('307-555-0199');
            await page.locator('#bk-email').fill('jamie@example.com');
            await page.locator('#bk-date').fill('2026-12-20');
            await page.locator('#bk-type').selectOption('Holiday party');
            await page.locator('#bk-place').fill('Powell');
            await page.locator('#bk-elf').selectOption('Not sure yet');
            await page.locator('#bk-photo').selectOption('No photos, please');
            await page.getByRole('button', { name: 'Send my request' }).click();
            await expect(page.locator('#bookingStatus')).toContainText('didn’t go through');
            await expect(page.locator('#bookingBody')).toBeVisible();
            await expect(page.locator('#bk-name')).toHaveValue('Jamie Frost');
        });
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

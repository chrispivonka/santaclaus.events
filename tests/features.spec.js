import { test, expect } from './fixtures.js';

// Every interactive feature on the page, end to end. Reduced motion is on for most of these so
// animations don't slow the flows down; the hero animation test turns it back off.
const DECEMBER_10 = new Date('2026-12-10T10:00:00');

test.describe('with reduced motion', () => {
    test.beforeEach(async ({ page }) => {
        await page.emulateMedia({ reducedMotion: 'reduce' });
    });

    test.describe('advent calendar in December', () => {
        test.beforeEach(async ({ page }) => {
            await page.clock.install({ time: DECEMBER_10 });
            await page.goto('/');
        });

        test('shows 24 doors, unlocks up to today and marks today', async ({ page }) => {
            const doors = page.locator('#adventGrid .door');
            await expect(doors).toHaveCount(24);
            await expect(page.locator('#adventGrid .door.is-locked')).toHaveCount(14);
            await expect(doors.nth(9)).toHaveClass(/is-today/);
            await expect(doors.nth(9)).not.toHaveClass(/is-locked/);
            await expect(doors.nth(23)).toHaveAttribute('aria-label', 'Door 24, locked until December 24');
            await expect(page.locator('#adventIntro')).toContainText('Today is door number 10');
        });

        test('a locked door shakes and says how many sleeps are left', async ({ page }) => {
            const door11 = page.locator('#adventGrid .door').nth(10);
            await door11.click();
            await expect(door11).toHaveClass(/shake/);
            await expect(page.locator('#toast')).toHaveClass(/show/);
            await expect(page.locator('#toast')).toContainText('Door 11 opens on December 11, 1 sleep from now');
            await expect(page.locator('#adventDialog')).toBeHidden();
        });

        test('opening a door shows its surprise, remembers it and reveals joke answers', async ({ page }) => {
            const door3 = page.locator('#adventGrid .door').nth(2);
            await door3.click();
            await expect(door3).toHaveClass(/is-open/);
            const dialog = page.locator('#adventDialog');
            await expect(dialog).toBeVisible();
            await expect(page.locator('#adventDialogDay')).toHaveText('December 3 · North Pole fact');
            await expect(page.locator('#adventDialogTitle')).toHaveText('Reindeer have super eyes');
            await expect(page.locator('#adventReveal')).toBeHidden();
            await dialog.getByRole('button', { name: 'Close' }).click();
            await expect(dialog).toBeHidden();

            const door1 = page.locator('#adventGrid .door').nth(0);
            await door1.click();
            await expect(dialog).toBeVisible();
            await expect(page.locator('#adventDialogDay')).toContainText('Christmas joke');
            await expect(page.locator('#adventDialogAnswer')).toBeHidden();
            await page.locator('#adventReveal').click();
            await expect(page.locator('#adventDialogAnswer')).toHaveText('A wrapper!');
            await page.keyboard.press('Escape');
            await expect(dialog).toBeHidden();

            expect(JSON.parse(await page.evaluate(() => localStorage.getItem('advent-2026')))).toEqual({ 1: true, 3: true });
            await page.reload();
            await expect(page.locator('#adventGrid .door.is-open')).toHaveCount(2);
            // An already-open door reopens its surprise without counting again.
            await page.locator('#adventGrid .door').nth(2).click();
            await expect(dialog).toBeVisible();
        });

        test('Christmas Eve links to the NORAD tracker safely', async ({ page }) => {
            await page.clock.setSystemTime(new Date('2026-12-24T10:00:00'));
            await page.reload();
            await page.locator('#adventGrid .door').nth(23).click();
            const link = page.locator('#adventDialogText a');
            await expect(link).toHaveAttribute('href', 'https://www.noradsanta.org/');
            await expect(link).toHaveAttribute('target', '_blank');
            await expect(link).toHaveAttribute('rel', /noopener/);
        });
    });

    test('advent calendar before December is locked with a countdown, and open until Epiphany', async ({ page }) => {
        await page.clock.install({ time: new Date('2026-11-20T10:00:00') });
        await page.goto('/');
        await expect(page.locator('#adventGrid .door.is-locked')).toHaveCount(24);
        await expect(page.locator('#adventIntro')).toContainText('just 11 sleeps away');

        await page.clock.setSystemTime(new Date('2027-01-03T10:00:00'));
        await page.reload();
        await expect(page.locator('#adventGrid .door.is-locked')).toHaveCount(0);
        await expect(page.locator('#adventIntro')).toContainText('Every door stays open until January 6th');
    });

    test('countdown and North Pole status follow the calendar', async ({ page }) => {
        await page.clock.install({ time: DECEMBER_10 });
        await page.goto('/');
        await expect(page.locator('[data-unit="days"]')).toHaveText('14');
        await expect(page.locator('#countdownSleeps')).toContainText(/\d+ sleeps/);
        await expect(page.locator('#santaStatus')).toHaveText('checking his list twice');
        await page.locator('#status').scrollIntoViewIfNeeded();
        for (const meter of await page.locator('.meter-value').all()) await expect(meter).toHaveText(/^\d+%$/);

        await page.clock.setSystemTime(new Date('2026-12-25T09:00:00'));
        await page.reload();
        await expect(page.locator('#countdownTitle')).toHaveText('Merry Christmas!');
        await expect(page.locator('#countdown')).toHaveClass(/is-christmas/);
        await expect(page.locator('#santaStatus')).toHaveText('taking a well-earned nap');
        await expect(page.locator('#year')).toHaveText('2026');
    });

    test.describe('games', () => {
        test.beforeEach(async ({ page }) => {
            await page.goto('/');
            await page.locator('#fun').scrollIntoViewIfNeeded();
        });

        test('Nice List checker: a name is on the list, Grinch is not, and the certificate prints', async ({ page }) => {
            await page.addInitScript(() => {
                window.testPrinted = 0;
                window.print = () => {
                    window.testPrinted++;
                };
            });
            await page.reload();
            await page.locator('#niceName').fill('ava');
            await page.locator('#niceForm button[type="submit"]').click();
            const verdict = page.locator('#niceVerdict');
            await expect(verdict).toHaveText('Ava, you’re on the Nice List!');
            await expect(page.locator('#niceNote')).toContainText(/You scored 9\d% nice|You scored 100% nice/);
            await expect(page.locator('#printCert')).toBeVisible();
            await expect.poll(() => page.locator('#gaugeFill').evaluate((el) => parseFloat(el.style.width))).toBeGreaterThan(80);

            await page.locator('#printCert').click();
            expect(await page.evaluate(() => window.testPrinted)).toBe(1);
            await expect(page.locator('#printArea .cert-name')).toHaveText('Ava');
            await expect(page.locator('#printArea .cert-body')).toContainText('official member of Santa’s Nice List');
            await expect(page.locator('body')).toHaveClass(/printing/);
            await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
            await expect(page.locator('body')).not.toHaveClass(/printing/);

            await page.locator('#niceName').fill('The Grinch');
            await page.locator('#niceForm button[type="submit"]').click();
            await expect(verdict).toHaveText('The Grinch, hmm…');
            await expect(page.locator('#printCert')).toBeHidden();
        });

        test('Nice List checker needs a name', async ({ page }) => {
            await page.locator('#niceName').fill('   ');
            await page.locator('#niceForm button[type="submit"]').click();
            await expect(page.locator('#toast')).toContainText('Santa needs a name');
            await expect(page.locator('#niceName')).toBeFocused();
        });

        test('elf name generator validates, then gives the same name for the same answers', async ({ page }) => {
            // The browser's own required-field check runs first; whitespace gets past it and reaches ours.
            await page.locator('#elfForm button[type="submit"]').click();
            await expect(page.locator('#elfFirst')).toBeFocused();
            expect(await page.locator('#elfFirst').evaluate((el) => el.validity.valueMissing)).toBe(true);
            await page.locator('#elfFirst').fill('   ');
            await page.locator('#elfMonth').selectOption('11');
            await page.locator('#elfForm button[type="submit"]').click();
            await expect(page.locator('#toast')).toContainText('Every elf needs a first name');
            await expect(page.locator('#elfFirst')).toBeFocused();
            await expect(page.locator('#elfBadge')).toBeHidden();
            await page.locator('#elfFirst').fill('Chris');
            await page.locator('#elfMonth').selectOption('');
            await page.locator('#elfForm button[type="submit"]').click();
            await expect(page.locator('#elfMonth')).toBeFocused();
            expect(await page.locator('#elfMonth').evaluate((el) => el.validity.valueMissing)).toBe(true);
            await page.locator('#elfMonth').selectOption('11');
            await page.locator('#elfForm button[type="submit"]').click();
            await expect(page.locator('#elfBadge')).toBeVisible();
            await expect(page.locator('#elfName')).toHaveText('Twinkle Starbright');
            await expect(page.locator('#elfJob')).toContainText('Job at the workshop: ');
            const job = await page.locator('#elfJob').textContent();
            await page.reload();
            await page.locator('#elfFirst').fill('Chris');
            await page.locator('#elfMonth').selectOption('11');
            await page.locator('#elfForm button[type="submit"]').click();
            await expect(page.locator('#elfJob')).toHaveText(job);
        });

        test('reindeer cards flip and flip back', async ({ page }) => {
            const cards = page.locator('.deer-card');
            await expect(cards).toHaveCount(9);
            await expect(cards.last()).toHaveText(/Rudolph/);
            await cards.last().click();
            await expect(cards.last()).toHaveAttribute('aria-pressed', 'true');
            await cards.last().click();
            await expect(cards.last()).toHaveAttribute('aria-pressed', 'false');
        });

        test('hide and seek counts the friends found and remembers them', async ({ page }) => {
            const peekers = page.locator('.peeker');
            await expect(peekers).toHaveCount(5);
            await expect(page.locator('#seekCount')).toHaveText('0');
            for (let i = 0; i < 5; i++) await peekers.nth(i).click({ force: true });
            await expect(page.locator('#seekCount')).toHaveText('5');
            await expect(page.locator('#toast')).toContainText('You found all five friends');
            await expect(page.locator('.peeker.found')).toHaveCount(5);
            await page.reload();
            await expect(page.locator('#seekCount')).toHaveText('5');
            await expect(page.locator('.peeker.found')).toHaveCount(5);
        });
    });

    test('the sleigh, the moon and the snowman all react', async ({ page }) => {
        // The sleigh only flies when motion is allowed.
        await page.emulateMedia({ reducedMotion: 'no-preference' });
        await page.goto('/');
        // The sleigh is mid-flight across the sky, so a pointer click can never settle on it.
        await page.locator('#sleigh').dispatchEvent('click');
        await expect(page.locator('.ho-bubble')).toHaveText(/Ho ho ho!|Merry Christmas!|On, Dasher!/);
        await expect(page.locator('.gift-drop')).toHaveCount(4);
        await page.locator('#snowman').click();
        await expect(page.locator('#snowman')).toHaveClass(/excited/);
        await expect(page.locator('.ho-bubble').last()).toHaveText(/Hi there!|Brrr!|I love hugs!|Let it snow!/);
        await page.locator('#moon').dispatchEvent('click'); // the sleigh may be passing in front of it
        await expect(page.locator('#toast')).toContainText('🌙');
    });

    test('sound and snow toggles are remembered', async ({ page }) => {
        await page.goto('/');
        const sound = page.locator('#soundToggle');
        await expect(sound).toHaveAttribute('aria-pressed', 'false');
        await sound.click();
        await expect(sound).toHaveAttribute('aria-pressed', 'true');
        await expect(sound).toHaveAccessibleName('Turn off Christmas sounds');
        await expect(page.locator('#toast')).toContainText('Sleigh bells on');

        // Snow is off by default when the visitor prefers reduced motion.
        const snow = page.locator('#snowToggle');
        await expect(snow).toHaveAttribute('aria-pressed', 'false');
        await expect(page.locator('#snowToggleLabel')).toHaveText('Snow off');
        await snow.click();
        await expect(page.locator('#snowToggleLabel')).toHaveText('Snow on');

        await page.reload();
        await expect(sound).toHaveAttribute('aria-pressed', 'true');
        await expect(snow).toHaveAttribute('aria-pressed', 'true');
    });

    test('the secret code starts a blizzard that blows over', async ({ page }) => {
        await page.clock.install({ time: DECEMBER_10 });
        await page.goto('/');
        for (const key of [
            'ArrowUp',
            'ArrowUp',
            'ArrowDown',
            'ArrowDown',
            'ArrowLeft',
            'ArrowRight',
            'ArrowLeft',
            'ArrowRight',
            'b',
            'a',
        ]) {
            await page.keyboard.press(key);
        }
        await expect(page.locator('html')).toHaveClass(/blizzard/);
        await expect(page.locator('#toast')).toContainText('Blizzard mode');
        await page.clock.fastForward(15_000);
        await expect(page.locator('html')).not.toHaveClass(/blizzard/);
    });

    test('back to top appears after scrolling and works', async ({ page }) => {
        await page.goto('/');
        const button = page.locator('#backToTop');
        await expect(button).not.toHaveClass(/show/);
        await page.locator('#letter').scrollIntoViewIfNeeded();
        await expect(button).toHaveClass(/show/);
        await button.click();
        await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
    });

    test('the nav highlights the section in view', async ({ page }) => {
        await page.goto('/');
        await page.locator('#about').scrollIntoViewIfNeeded();
        await expect(page.locator('.nav-links a[aria-current="true"]')).toHaveAttribute('href', '#about');
    });

    test.describe('letter to Santa', () => {
        test.beforeEach(async ({ page }) => {
            await page.goto('/');
            await page.locator('#letter').scrollIntoViewIfNeeded();
        });

        test('wish ideas add lines once, the sign-off follows the name, and bad emails are caught', async ({ page }) => {
            const teddy = page.locator('.wish-chips button').first();
            await teddy.click();
            await teddy.click();
            const message = page.locator('#message');
            expect((await message.inputValue()).match(/cuddly teddy bear/g)).toHaveLength(1);
            await expect(teddy).toHaveClass(/added/);
            await page.locator('.wish-chips button').nth(1).click();
            expect((await message.inputValue()).split('\n')).toHaveLength(2);

            await page.locator('#name').fill('Ava');
            await expect(page.locator('#signoffName')).toHaveText('Ava');

            const email = page.locator('#email');
            await email.fill('not-an-email');
            await email.blur();
            await expect(email).toHaveAttribute('aria-invalid', 'true');
            await expect(page.locator('#email-error')).toHaveText('Santa needs a valid email so the elves can write back!');
            await expect(email).toHaveAttribute('aria-describedby', 'email-error');
            await email.fill('ava@example.com');
            await expect(email).toHaveAttribute('aria-invalid', 'false');
            await expect(page.locator('#email-error')).toBeEmpty();
        });

        test('a successful send resets the form and celebrates', async ({ page }) => {
            await page.locator('#name').fill('Ava');
            await page.locator('#email').fill('ava@example.com');
            await page.locator('#message').fill('A sled, please.');
            await page.locator('#submitButton').click();
            await expect(page.locator('#formStatus')).toContainText('landed on Santa’s desk');
            await expect(page.locator('#formStatus')).not.toHaveClass(/is-error/);
            await expect(page.locator('#name')).toHaveValue('');
            await expect(page.locator('#signoffName')).toHaveText('me');
            await expect(page.locator('#letterForm')).toHaveClass(/sent/);
            await expect(page.locator('#submitButton')).toBeEnabled();
        });

        test.describe('when the network is down', () => {
            // The browser logs the failed request; that is the one error this test expects.
            test.use({ allowedErrors: [/Failed to load resource/] });

            test('a network failure keeps the letter and explains', async ({ page }) => {
                await page.route(/^https:\/\/script\.google\.com\//, (route) => route.abort('failed'));
                await page.locator('#name').fill('Ava');
                await page.locator('#email').fill('ava@example.com');
                await page.locator('#message').fill('A sled, please.');
                await page.locator('#submitButton').click();
                await expect(page.locator('#formStatus')).toHaveClass(/is-error/);
                await expect(page.locator('#formStatus')).toContainText('snowdrift');
                await expect(page.locator('#message')).toHaveValue('A sled, please.');
                await expect(page.locator('#submitButton')).toBeEnabled();
            });
        });
    });
});

test.describe('without reduced motion', () => {
    test('the headline drops in letter by letter and keeps its accessible name', async ({ page }) => {
        await page.goto('/');
        const accent = page.locator('.hero h1 .accent');
        await expect(accent).toHaveClass(/lettered/);
        await expect(accent.locator('.ltr')).toHaveCount('Santa Claus!'.length);
        await expect(page.getByRole('heading', { level: 1 })).toHaveAccessibleName('Hello from Santa Claus!');
    });

    test('the snow canvas runs, the lights hang and the stars are out', async ({ page }) => {
        await page.goto('/');
        await expect(page.locator('#snowToggleLabel')).toHaveText('Snow on');
        await expect(page.locator('#snow')).toBeAttached();
        await expect(page.locator('#stars .star')).toHaveCount(70);
        const width = await page.evaluate(() => window.innerWidth);
        await expect(page.locator('#lights li')).toHaveCount(Math.ceil(width / 56) + 1);
    });

    test('a remembered theme applies before the first paint', async ({ page }) => {
        await page.addInitScript(() => {
            localStorage.setItem('site-theme', 'light');
            document.addEventListener('DOMContentLoaded', () => {
                window.testThemeAtDomReady = document.documentElement.getAttribute('data-theme');
            });
        });
        await page.goto('/');
        expect(await page.evaluate(() => window.testThemeAtDomReady)).toBe('light');
        await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#fbf6ee');
    });
});

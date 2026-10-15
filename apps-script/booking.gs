/**
 * Booking requests from santaclaus.events: private events and photo shoots.
 *
 * The site's booking pop-up posts its fields here (like the letter form does to its own script).
 * Each kind of request is emailed to its own list of people, set in Script Properties:
 *   PRIVATE_RECIPIENTS  private events (for example Santa and Hanna)
 *   PHOTO_RECIPIENTS    photo shoots (for example Written In Light)
 *   CALENDAR_ID         Santa's Google Calendar, checked for times that are already booked
 *   PRIVATE_MINUTES, PHOTO_MINUTES (optional) how long each kind of booking lasts (default 60 and 30)
 *   PRIVATE_TEXT_TO, PHOTO_TEXT_TO (optional) phone numbers that also get a text about each request,
 *     sent through Twilio with TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_FROM
 * Setup steps are in apps-script/README.md. Keep email addresses in the script properties,
 * never in this file, so they stay out of the public repository and off the site.
 */

var KINDS = {
    'private-booking': {
        label: 'Private booking request',
        recipients: 'PRIVATE_RECIPIENTS',
        textTo: 'PRIVATE_TEXT_TO',
        minutes: 'PRIVATE_MINUTES',
        defaultMinutes: 60,
        fields: [
            ['name', 'Name'],
            ['phone', 'Phone'],
            ['email', 'Email'],
            ['date', 'Event date'],
            ['time', 'Start time'],
            ['eventType', 'Type of event'],
            ['place', 'Town or venue'],
            ['kids', 'Number of kids'],
            ['elf', 'Add an elf?'],
            ['photo', 'Advertising photo'],
            ['notes', 'Notes'],
        ],
    },
    'photo-shoot': {
        label: 'Photo shoot request',
        recipients: 'PHOTO_RECIPIENTS',
        textTo: 'PHOTO_TEXT_TO',
        minutes: 'PHOTO_MINUTES',
        defaultMinutes: 30,
        fields: [
            ['name', 'Name'],
            ['phone', 'Phone'],
            ['email', 'Email'],
            ['date', 'Preferred date'],
            ['time', 'Preferred time'],
            ['people', 'People in the photos'],
            ['notes', 'Notes'],
        ],
    },
};

// GET ?availability=1&date=YYYY-MM-DD&formType=...: the busy stretches on Santa's calendar that day,
// as [start, end] minutes after midnight in the calendar's time zone. Only times go out, never event details.
function doGet(e) {
    var p = (e && e.parameter) || {};
    var kind = KINDS[p.formType] || KINDS['private-booking'];
    if (!p.availability || !/^\d{4}-\d{2}-\d{2}$/.test(p.date || '')) return json({ error: 'bad request' });
    return json({ date: p.date, duration: durationOf(kind), busy: busyOn(p.date) });
}

function doPost(e) {
    var p = (e && e.parameter) || {};
    var kind = KINDS[p.formType];

    // The honeypot field is invisible to people, so anything in it came from a bot.
    if (p.website) return ContentService.createTextOutput('ok');
    if (!kind || !p.name || !p.email) return ContentService.createTextOutput('missing fields');

    var props = PropertiesService.getScriptProperties();
    var recipients = props.getProperty(kind.recipients);
    if (!recipients) throw new Error('Set the ' + kind.recipients + ' script property (comma-separated emails).');

    // The site already hides booked times, but two people can pick the same one at once.
    var conflict = false;
    var start = minutesOf(p.time);
    if (start !== null && /^\d{4}-\d{2}-\d{2}$/.test(p.date || '')) {
        var end = start + durationOf(kind);
        conflict = busyOn(p.date).some(function (b) {
            return start < b[1] && end > b[0];
        });
    }

    var lines = kind.fields.map(function (f) {
        return f[1] + ': ' + (clean(p[f[0]]) || '(not given)');
    });
    var body =
        (conflict ? "HEADS UP: this time overlaps something already on Santa's calendar.\n\n" : '') +
        'A new ' +
        kind.label.toLowerCase() +
        ' came in from santaclaus.events.\n\n' +
        lines.join('\n') +
        '\n\nReply to this email to answer ' +
        clean(p.name) +
        ' directly.';

    MailApp.sendEmail({
        to: recipients,
        replyTo: clean(p.email),
        subject:
            (conflict ? '[Time already booked] ' : '') +
            kind.label +
            ': ' +
            clean(p.name) +
            ' on ' +
            (clean(p.date) || 'a date to confirm'),
        body: body,
        name: 'Santa Claus Events',
    });

    // Optional: a short text to each number in PRIVATE_TEXT_TO or PHOTO_TEXT_TO. The email has the details.
    // A failed text never stops the email or the log.
    try {
        sendTexts(
            props,
            props.getProperty(kind.textTo),
            (conflict ? '[Time already booked] ' : '') +
                'New ' +
                kind.label.toLowerCase() +
                ' from ' +
                clean(p.name).slice(0, 60) +
                ' for ' +
                (clean(p.date) || 'a date to confirm') +
                (clean(p.time) ? ' at ' + clean(p.time) : '') +
                '. Phone: ' +
                (clean(p.phone).slice(0, 30) || 'not given') +
                '. Details are in your email.',
        );
    } catch (err) {
        console.error('Text alert failed: ' + err);
    }

    // Optional: keep a log of every request in a Google Sheet, one tab per kind (see README.md).
    var sheetId = props.getProperty('SHEET_ID');
    if (sheetId) {
        var book = SpreadsheetApp.openById(sheetId);
        var sheet = book.getSheetByName(kind.label) || book.insertSheet(kind.label);
        if (sheet.getLastRow() === 0) {
            sheet.appendRow(
                ['Received'].concat(
                    kind.fields.map(function (f) {
                        return f[1];
                    }),
                ),
            );
        }
        sheet.appendRow(
            [new Date()].concat(
                kind.fields.map(function (f) {
                    return clean(p[f[0]]);
                }),
            ),
        );
    }

    return ContentService.createTextOutput('ok');
}

// Texts each comma-separated number through Twilio's Messages API, if Twilio is set up.
function sendTexts(props, numbers, message) {
    var sid = props.getProperty('TWILIO_ACCOUNT_SID');
    var token = props.getProperty('TWILIO_AUTH_TOKEN');
    var from = props.getProperty('TWILIO_FROM');
    if (!numbers || !sid || !token || !from) return;
    numbers.split(',').forEach(function (to) {
        to = to.trim();
        if (!to) return;
        var response = UrlFetchApp.fetch('https://api.twilio.com/2010-04-01/Accounts/' + sid + '/Messages.json', {
            method: 'post',
            headers: { Authorization: 'Basic ' + Utilities.base64Encode(sid + ':' + token) },
            payload: { To: to, From: from, Body: message },
            muteHttpExceptions: true,
        });
        if (response.getResponseCode() >= 300) console.error('Twilio said ' + response.getContentText());
    });
}

function durationOf(kind) {
    return Number(PropertiesService.getScriptProperties().getProperty(kind.minutes)) || kind.defaultMinutes;
}

// Busy stretches on the calendar for one day, as [start, end] minutes after midnight.
function busyOn(date) {
    var id = PropertiesService.getScriptProperties().getProperty('CALENDAR_ID');
    var calendar = id ? CalendarApp.getCalendarById(id) : null;
    if (!calendar) return [];
    var zone = calendar.getTimeZone();
    var dayStart = Utilities.parseDate(date + ' 00:00', zone, 'yyyy-MM-dd HH:mm');
    var dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
    return calendar.getEvents(dayStart, dayEnd).map(function (event) {
        if (event.isAllDayEvent()) return [0, 24 * 60];
        var s = Math.max(0, (event.getStartTime() - dayStart) / 60000);
        var e = Math.min(24 * 60, (event.getEndTime() - dayStart) / 60000);
        return [Math.round(s), Math.round(e)];
    });
}

function minutesOf(time) {
    var m = /^(\d{1,2}):(\d{2})$/.exec(String(time || ''));
    return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

function json(value) {
    return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}

// Keeps each value to one tidy, reasonably short piece of text.
function clean(value) {
    return String(value || '')
        .replace(/[\r\n]+/g, ' ')
        .trim()
        .slice(0, 2000);
}

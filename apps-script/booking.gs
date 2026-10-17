/**
 * Booking requests from santaclaus.events: private events and photo shoots.
 *
 * The site's booking pop-up posts its fields here (like the letter form does to its own script).
 * Each kind of request is emailed to its own list of people, set in Script Properties:
 *   PRIVATE_RECIPIENTS  private events (for example Santa and Hanna)
 *   PHOTO_RECIPIENTS    photo shoots (for example Written In Light)
 *   CALENDAR_ID         Santa's Google Calendar, checked for times that are already booked
 *   PRIVATE_MINUTES, PHOTO_MINUTES (optional) how long each kind of booking lasts (default 60 and 30)
 * Needs common.gs in the same project. Setup steps are in apps-script/README.md. Keep email addresses in the script properties,
 * never in this file, so they stay out of the public repository and off the site.
 */

var BOOKING_LIMITS = { all: 30, email: 3 };

// The fields each kind of request accepts, in the order they're emailed (types are in common.gs).
var CONTACT_FIELDS = [
    { name: 'name', label: 'Name', type: 'name', required: true, max: 100 },
    { name: 'phone', label: 'Phone', type: 'phone', required: true, max: 30 },
    { name: 'email', label: 'Email', type: 'email', required: true, max: 254 },
];
var KINDS = {
    'private-booking': {
        label: 'Private booking request',
        recipients: 'PRIVATE_RECIPIENTS',
        minutes: 'PRIVATE_MINUTES',
        defaultMinutes: 60,
        fields: CONTACT_FIELDS.concat([
            { name: 'date', label: 'Event date', type: 'date', required: true },
            { name: 'time', label: 'Start time', type: 'time', required: true },
            {
                name: 'eventType',
                label: 'Type of event',
                type: 'choice',
                required: true,
                options: [
                    'Home visit',
                    'Holiday party',
                    'School or classroom',
                    'Business or workplace',
                    'Church or community event',
                    'Something else',
                ],
            },
            { name: 'place', label: 'Town or venue', type: 'line', required: true, max: 200 },
            { name: 'kids', label: 'Number of kids', type: 'int', min: 0, maxValue: 500 },
            {
                name: 'elf',
                label: 'Add an elf?',
                type: 'choice',
                required: true,
                options: ['Yes, please', 'No, thank you', 'Not sure yet'],
            },
            {
                name: 'photo',
                label: 'Advertising photo',
                type: 'choice',
                required: true,
                options: ['Yes', 'Yes, but only from behind (no faces)', 'No photos, please'],
            },
            { name: 'notes', label: 'Notes', type: 'text', max: 2000 },
        ]),
    },
    'photo-shoot': {
        label: 'Photo shoot request',
        recipients: 'PHOTO_RECIPIENTS',
        minutes: 'PHOTO_MINUTES',
        defaultMinutes: 30,
        fields: CONTACT_FIELDS.concat([
            { name: 'date', label: 'Preferred date', type: 'date', required: true },
            { name: 'time', label: 'Preferred time', type: 'time', required: true },
            { name: 'people', label: 'People in the photos', type: 'int', min: 1, maxValue: 100 },
            { name: 'notes', label: 'Notes', type: 'text', max: 2000 },
        ]),
    },
};

// GET ?availability=1&date=YYYY-MM-DD&formType=...: the busy stretches on Santa's calendar that day,
// as [start, end] minutes after midnight in the calendar's time zone. Only times go out, never event details.
function doGet(e) {
    var p = (e && e.parameter) || {};
    var kind = KINDS[p.formType] || KINDS['private-booking'];
    if (!p.availability || !isBookableDate(String(p.date || ''))) return json({ error: 'bad request' });
    return json({ date: p.date, duration: durationOf(kind), busy: busyOn(p.date) });
}

function doPost(e) {
    var p = (e && e.parameter) || {};

    // The honeypot field is invisible to people, so anything in it came from a bot.
    if (p.website) return reply('ok');
    var kind = Object.prototype.hasOwnProperty.call(KINDS, p.formType) ? KINDS[p.formType] : null;
    if (!kind) return reply('unknown form');
    // The site checks the same rules, so only a request that skipped the site gets turned away here.
    var checked = checkFields(kind.fields, p);
    if (checked.errors) return reply('invalid: ' + checked.errors.join('; '));
    var v = checked.values;
    if (tooMany(v.email, BOOKING_LIMITS)) return reply('too many requests');

    var props = PropertiesService.getScriptProperties();
    var recipients = props.getProperty(kind.recipients);
    if (!recipients) throw new Error('Set the ' + kind.recipients + ' script property (comma-separated emails).');

    // The site already hides booked times, but two people can pick the same one at once.
    var start = minutesOf(v.time);
    var end = start + durationOf(kind);
    var conflict = busyOn(v.date).some(function (b) {
        return start < b[1] && end > b[0];
    });

    var lines = kind.fields.map(function (f) {
        var value = v[f.name] || '(not given)';
        return f.type === 'text' && value.indexOf('\n') !== -1 ? f.label + ':\n' + value : f.label + ': ' + value;
    });
    MailApp.sendEmail({
        to: recipients,
        replyTo: v.email,
        subject: (conflict ? '[Time already booked] ' : '') + kind.label + ': ' + v.name + ' on ' + v.date,
        body:
            (conflict ? "HEADS UP: this time overlaps something already on Santa's calendar.\n\n" : '') +
            'A new ' +
            kind.label.toLowerCase() +
            ' came in from santaclaus.events.\n\n' +
            lines.join('\n') +
            '\n\nReply to this email to answer ' +
            v.name +
            ' directly.',
        name: 'Santa Claus Events',
    });

    // Optional: keep a log of every request in a Google Sheet, one tab per kind (see README.md).
    var sheetId = props.getProperty('SHEET_ID');
    if (sheetId) {
        var book = SpreadsheetApp.openById(sheetId);
        var sheet = book.getSheetByName(kind.label) || book.insertSheet(kind.label);
        if (sheet.getLastRow() === 0) {
            sheet.appendRow(
                ['Received'].concat(
                    kind.fields.map(function (f) {
                        return f.label;
                    }),
                ),
            );
        }
        sheet.appendRow(
            [new Date()].concat(
                kind.fields.map(function (f) {
                    return asText(v[f.name]);
                }),
            ),
        );
    }

    return reply('ok');
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

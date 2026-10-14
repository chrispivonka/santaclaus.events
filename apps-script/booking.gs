/**
 * Booking requests from santaclaus.events: private events and photo shoots.
 *
 * The site's booking pop-up posts its fields here (like the letter form does to its own script).
 * Each kind of request is emailed to its own list of people, set in Script Properties:
 *   PRIVATE_RECIPIENTS  private events (for example Santa and Hanna)
 *   PHOTO_RECIPIENTS    photo shoots (for example Written In Light)
 * Setup steps are in apps-script/README.md. Keep email addresses in the script properties,
 * never in this file, so they stay out of the public repository and off the site.
 */

var KINDS = {
    'private-booking': {
        label: 'Private booking request',
        recipients: 'PRIVATE_RECIPIENTS',
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

function doPost(e) {
    var p = (e && e.parameter) || {};
    var kind = KINDS[p.formType];

    // The honeypot field is invisible to people, so anything in it came from a bot.
    if (p.website) return ContentService.createTextOutput('ok');
    if (!kind || !p.name || !p.email) return ContentService.createTextOutput('missing fields');

    var props = PropertiesService.getScriptProperties();
    var recipients = props.getProperty(kind.recipients);
    if (!recipients) throw new Error('Set the ' + kind.recipients + ' script property (comma-separated emails).');

    var lines = kind.fields.map(function (f) {
        return f[1] + ': ' + (clean(p[f[0]]) || '(not given)');
    });
    var body =
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
        subject: kind.label + ': ' + clean(p.name) + ' on ' + (clean(p.date) || 'a date to confirm'),
        body: body,
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

// Keeps each value to one tidy, reasonably short piece of text.
function clean(value) {
    return String(value || '')
        .replace(/[\r\n]+/g, ' ')
        .trim()
        .slice(0, 2000);
}

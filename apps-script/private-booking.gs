/**
 * Private booking requests from santaclaus.events.
 *
 * The site's booking pop-up posts its fields here (like the letter form does to its own script),
 * and this emails the request to everyone listed in the RECIPIENTS script property.
 * Setup steps are in apps-script/README.md. Keep email addresses in the script property,
 * never in this file, so they stay out of the public repository.
 */

var FIELDS = [
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
];

function doPost(e) {
    var p = (e && e.parameter) || {};

    // The honeypot field is invisible to people, so anything in it came from a bot.
    if (p.website) return ContentService.createTextOutput('ok');
    if (p.formType !== 'private-booking' || !p.name || !p.email) {
        return ContentService.createTextOutput('missing fields');
    }

    var recipients = PropertiesService.getScriptProperties().getProperty('RECIPIENTS');
    if (!recipients) throw new Error('Set the RECIPIENTS script property (comma-separated emails).');

    var lines = FIELDS.map(function (f) {
        return f[1] + ': ' + (clean(p[f[0]]) || '(not given)');
    });
    var body =
        'A new private booking request came in from santaclaus.events.\n\n' +
        lines.join('\n') +
        '\n\nReply to this email to answer ' +
        clean(p.name) +
        ' directly.';

    MailApp.sendEmail({
        to: recipients,
        replyTo: clean(p.email),
        subject: 'Private booking request: ' + clean(p.name) + ' on ' + (clean(p.date) || 'a date to confirm'),
        body: body,
        name: 'Santa Claus Events',
    });

    // Optional: keep a log of every request in a Google Sheet (see README.md).
    var sheetId = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
    if (sheetId) {
        var sheet = SpreadsheetApp.openById(sheetId).getSheets()[0];
        if (sheet.getLastRow() === 0) {
            sheet.appendRow(
                ['Received'].concat(
                    FIELDS.map(function (f) {
                        return f[1];
                    }),
                ),
            );
        }
        sheet.appendRow(
            [new Date()].concat(
                FIELDS.map(function (f) {
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

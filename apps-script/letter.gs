/**
 * Letters to Santa from santaclaus.events.
 *
 * The site's letter form posts the child's first name, a grown-up's email, the letter and the hidden
 * honeypot field here. Each letter is emailed to the people in the LETTER_RECIPIENTS script property,
 * with Reply-To set to the grown-up's address so a reply goes straight back to the family.
 *   LETTER_RECIPIENTS  who reads the letters, comma-separated emails
 * Letters are emailed only and never stored here, so once a letter is answered it can be deleted
 * from the inbox and nothing about the child is kept. Needs common.gs in the same project; setup
 * steps are in apps-script/README.md.
 */

var LETTER_LIMITS = { all: 60, email: 3 };

// The only fields a letter accepts (types are in common.gs).
var LETTER_FIELDS = [
    { name: 'name', label: 'First name', type: 'name', required: true, max: 40 },
    { name: 'email', label: 'Grown-up’s email', type: 'email', required: true, max: 254 },
    { name: 'message', label: 'Letter', type: 'text', required: true, max: 5000 },
];

function doPost(e) {
    var p = (e && e.parameter) || {};

    // The honeypot field is invisible to people, so anything in it came from a bot.
    if (p.website) return reply('ok');
    // The site checks the same rules, so only a request that skipped the site gets turned away here.
    var checked = checkFields(LETTER_FIELDS, p);
    if (checked.errors) return reply('invalid: ' + checked.errors.join('; '));
    var v = checked.values;
    if (tooMany(v.email, LETTER_LIMITS)) return reply('too many requests');

    var recipients = PropertiesService.getScriptProperties().getProperty('LETTER_RECIPIENTS');
    if (!recipients) throw new Error('Set the LETTER_RECIPIENTS script property (comma-separated emails).');

    MailApp.sendEmail({
        to: recipients,
        replyTo: v.email,
        subject: 'Letter to Santa from ' + v.name,
        body:
            'A new letter to Santa came in from santaclaus.events.\n\n' +
            'From: ' +
            v.name +
            '\n\n' +
            v.message +
            '\n\nReply to this email to answer their grown-up. Once the letter is answered, please delete it.',
        name: 'Santa Claus Events',
    });

    return reply('ok');
}

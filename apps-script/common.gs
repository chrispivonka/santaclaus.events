/**
 * Checks shared by the site's form scripts. Add this file next to booking.gs or letter.gs in the
 * same Apps Script project (see apps-script/README.md).
 *
 * Every field a form sends is described by a spec, and nothing else from the request is used:
 *   { name, label, type, required, max, options, min, maxValue }
 * Types:
 *   name      a person's name: letters, spaces and ' - . , & only
 *   email     one plain address
 *   phone     digits and + ( ) - . spaces, with 7 to 15 digits
 *   date      YYYY-MM-DD, a real day from today up to two years ahead
 *   time      HH:MM on the hour or half hour
 *   int       a whole number from min to maxValue
 *   choice    exactly one of options
 *   line      free text on one line, cut down to safe characters
 *   text      free text that keeps its line breaks, cut down to safe characters
 */

// Letters and accents in any language, digits, whitespace and everyday punctuation. Everything else
// (symbols, emoji, angle brackets, control characters) is removed from free text before it's used.
var UNSAFE_TEXT = /[^\p{L}\p{M}\p{N}\s.,!?'"‘’“”()\-–—:;&/#+%]/gu;
var NAME_PATTERN = /^[\p{L}\p{M}][\p{L}\p{M} '’.,&-]*$/u;
var EMAIL_PATTERN = /^[^\s@,;:<>()[\]\\"']+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$/;
var PHONE_PATTERN = /^\+?[0-9 ().-]+$/;

// Free text with unsafe characters removed, spaces tidied and cut to `max` characters.
function safeText(value, max, multiline) {
    var text = String(value == null ? '' : value)
        .normalize('NFC')
        .replace(/\r\n?/g, '\n')
        .replace(UNSAFE_TEXT, '');
    text = multiline
        ? text
              .replace(/[^\S\n]+/g, ' ')
              .replace(/ *\n */g, '\n')
              .replace(/\n{3,}/g, '\n\n')
        : text.replace(/\s+/g, ' ');
    return text.trim().slice(0, max);
}

// Checks one value against its spec: { value } when it passes (value is '' for an empty optional
// field), or { error } saying what's wrong.
function checkField(spec, raw) {
    var max = spec.max || 200;
    var value = String(raw == null ? '' : raw).trim();
    if (value.length > max * 2) return { error: spec.label + ' is too long' };
    if (spec.type === 'line' || spec.type === 'text') value = safeText(value, max, spec.type === 'text');
    if (!value) return spec.required ? { error: spec.label + ' is required' } : { value: '' };
    if (value.length > max) return { error: spec.label + ' is too long' };

    switch (spec.type) {
        case 'name':
            value = value.normalize('NFC').replace(/\s+/g, ' ');
            return NAME_PATTERN.test(value) ? { value: value } : { error: spec.label + ' has characters a name can’t have' };
        case 'email':
            return EMAIL_PATTERN.test(value) && value.length <= 254 ? { value: value } : { error: spec.label + ' isn’t a valid email' };
        case 'phone':
            var digits = value.replace(/\D/g, '').length;
            return PHONE_PATTERN.test(value) && digits >= 7 && digits <= 15
                ? { value: value }
                : { error: spec.label + ' isn’t a valid phone number' };
        case 'date':
            return isBookableDate(value) ? { value: value } : { error: spec.label + ' isn’t a date we can book' };
        case 'time':
            return /^([01]\d|2[0-3]):(00|30)$/.test(value) ? { value: value } : { error: spec.label + ' isn’t a valid time' };
        case 'int':
            var n = Number(value);
            return /^\d{1,4}$/.test(value) && n >= (spec.min || 0) && n <= spec.maxValue
                ? { value: String(n) }
                : { error: spec.label + ' must be a whole number from ' + (spec.min || 0) + ' to ' + spec.maxValue };
        case 'choice':
            return spec.options.indexOf(value) !== -1 ? { value: value } : { error: spec.label + ' isn’t one of the choices' };
        case 'line':
        case 'text':
            return { value: value };
    }
    return { error: spec.label + ' has an unknown type' };
}

// Checks every field in specs. Returns { values } keyed by field name, or { errors }.
function checkFields(specs, params) {
    var values = {};
    var errors = [];
    specs.forEach(function (spec) {
        var result = checkField(spec, params[spec.name]);
        if (result.error) errors.push(result.error);
        else values[spec.name] = result.value;
    });
    return errors.length ? { errors: errors } : { values: values };
}

// A real calendar day, no earlier than yesterday (time zones differ) and no more than two years out.
function isBookableDate(value) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!m) return false;
    var day = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
    if (day.getUTCFullYear() !== Number(m[1]) || day.getUTCMonth() !== Number(m[2]) - 1 || day.getUTCDate() !== Number(m[3])) {
        return false;
    }
    var now = Date.now();
    var dayMs = 24 * 60 * 60 * 1000;
    return day.getTime() >= now - 2 * dayMs && day.getTime() <= now + 731 * dayMs;
}

// At most limits.email requests an hour from one address and limits.all an hour in all, so a script
// posting straight to the public web app can't use up the account's daily email quota.
function tooMany(email, limits) {
    var cache = CacheService.getScriptCache();
    var lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
        var keys = ['all', 'email:' + String(email).toLowerCase()];
        var max = [limits.all, limits.email];
        var counts = keys.map(function (key) {
            return Number(cache.get(key)) || 0;
        });
        if (counts[0] >= max[0] || counts[1] >= max[1]) return true;
        keys.forEach(function (key, i) {
            cache.put(key, String(counts[i] + 1), 60 * 60);
        });
        return false;
    } finally {
        lock.releaseLock();
    }
}

// A sheet treats a value starting with =, +, - or @ as a formula, so those are stored as plain text.
function asText(value) {
    return /^[=+\-@]/.test(value) ? "'" + value : value;
}

function reply(text) {
    return ContentService.createTextOutput(text);
}

function json(value) {
    return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}

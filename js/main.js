// Santa Claus Events: core page scripts (theme, menu, countdown, letter form).
// The playful extras live in js/fun.js.
(function () {
    'use strict';

    var root = document.documentElement;
    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // ---- Theme toggle (dark by default; the choice is remembered) ----
    var themeToggle = document.getElementById('themeToggle');
    function applyTheme(name) {
        root.setAttribute('data-theme', name);
        themeToggle.setAttribute('aria-label', name === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
        document.querySelector('meta[name="theme-color"]').setAttribute('content', name === 'dark' ? '#0d1626' : '#fbf6ee');
    }
    applyTheme(root.getAttribute('data-theme') === 'light' ? 'light' : 'dark');
    themeToggle.addEventListener('click', function () {
        var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        applyTheme(next);
        try {
            localStorage.setItem('site-theme', next);
        } catch (e) {}
    });

    // ---- Mobile menu ----
    var navToggle = document.getElementById('navToggle');
    var navLinks = document.getElementById('navLinks');
    function setMenu(open) {
        navLinks.classList.toggle('open', open);
        navToggle.setAttribute('aria-expanded', String(open));
    }
    navToggle.addEventListener('click', function () {
        setMenu(!navLinks.classList.contains('open'));
    });
    navLinks.addEventListener('click', function (e) {
        if (e.target.closest('a')) setMenu(false);
    });
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') setMenu(false);
    });

    // ---- Header border + back-to-top on scroll ----
    var header = document.getElementById('siteHeader');
    var backToTop = document.getElementById('backToTop');
    function onScroll() {
        header.classList.toggle('scrolled', window.scrollY > 8);
        backToTop.classList.toggle('show', window.scrollY > 600);
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    backToTop.addEventListener('click', function () {
        window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
    });

    // ---- Highlight the nav link for the section in view ----
    if ('IntersectionObserver' in window) {
        var links = {};
        navLinks.querySelectorAll('a[href^="#"]').forEach(function (a) {
            links[a.getAttribute('href').slice(1)] = a;
        });
        var spy = new IntersectionObserver(
            function (entries) {
                entries.forEach(function (entry) {
                    var link = links[entry.target.id];
                    if (link && entry.isIntersecting) {
                        Object.keys(links).forEach(function (k) {
                            links[k].removeAttribute('aria-current');
                        });
                        link.setAttribute('aria-current', 'true');
                    }
                });
            },
            { rootMargin: '-45% 0px -50% 0px' },
        );
        Object.keys(links).forEach(function (id) {
            var section = document.getElementById(id);
            if (section) spy.observe(section);
        });
    }

    // ---- Christmas countdown (visitor's local time) ----
    var countdown = document.getElementById('countdown');
    var countdownTitle = document.getElementById('countdownTitle');
    var units = {};
    countdown.querySelectorAll('[data-unit]').forEach(function (el) {
        units[el.dataset.unit] = el;
    });
    function setTitle(text, isChristmas) {
        if (countdownTitle.textContent === text) return;
        countdownTitle.textContent = text;
        countdown.classList.toggle('is-christmas', isChristmas);
    }
    var sleeps = document.getElementById('countdownSleeps');
    function pad(n) {
        return String(n).padStart(2, '0');
    }
    function setUnit(name, value) {
        var el = units[name];
        if (el.textContent === String(value)) return;
        el.textContent = value;
        if (!reduceMotion) {
            el.classList.remove('tick');
            void el.offsetWidth; // restart the little flip animation
            el.classList.add('tick');
        }
    }
    function setSleeps(text) {
        if (sleeps.textContent !== text) sleeps.textContent = text;
    }
    function tick() {
        var now = new Date();
        var year = now.getFullYear();
        // All of Christmas Day is celebrated; the countdown restarts on the 26th.
        if (now.getMonth() === 11 && now.getDate() === 25) {
            setTitle('Merry Christmas!', true);
            setSleeps('Santa came! Go check your stocking.');
            return;
        }
        setTitle('Countdown to Christmas', false);
        var target = new Date(year, 11, 25);
        if (now > target) target = new Date(year + 1, 11, 25);
        var diff = Math.max(0, target - now);
        setUnit('days', Math.floor(diff / 864e5));
        setUnit('hours', pad(Math.floor(diff / 36e5) % 24));
        setUnit('minutes', pad(Math.floor(diff / 6e4) % 60));
        setUnit('seconds', pad(Math.floor(diff / 1e3) % 60));
        // "Sleeps" counts calendar nights, the way kids count them.
        var today = new Date(year, now.getMonth(), now.getDate());
        var nights = Math.round((target - today) / 864e5);
        setSleeps(nights === 1 ? 'Santa comes tonight! Time for bed.' : 'Only ' + nights + ' sleeps to go!');
    }
    tick();
    setInterval(tick, 1000);
    // Screen readers shouldn't hear every second tick; only announce on changes to the title.
    countdown.querySelector('.countdown-units').setAttribute('aria-hidden', 'true');
    countdown.setAttribute('aria-label', 'Countdown to Christmas');

    // ---- Show the events calendar in the visitor's own time zone ----
    // Google's embed is heavy, so it only loads once the visitor scrolls close to it.
    var iframe = document.getElementById('calendarEmbed');
    function loadCalendar() {
        var src = iframe.getAttribute('data-src');
        try {
            var url = new URL(src);
            var tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
            if (tz) url.searchParams.set('ctz', tz);
            src = url.toString();
        } catch (e) {}
        iframe.src = src;
    }
    if (iframe) {
        if ('IntersectionObserver' in window) {
            var calendarObserver = new IntersectionObserver(
                function (entries) {
                    if (
                        entries.some(function (entry) {
                            return entry.isIntersecting;
                        })
                    ) {
                        calendarObserver.disconnect();
                        loadCalendar();
                    }
                },
                { rootMargin: '600px 0px' },
            );
            calendarObserver.observe(iframe);
        } else {
            loadCalendar();
        }
    }

    // ---- Footer year ----
    document.getElementById('year').textContent = new Date().getFullYear();

    // ---- Letter to Santa form ----
    var form = document.getElementById('letterForm');
    var submitButton = document.getElementById('submitButton');
    var submitLabel = submitButton.querySelector('.btn-label');
    var status = document.getElementById('formStatus');
    var signoff = document.getElementById('signoffName');
    var fields = ['name', 'email', 'message'].map(function (id) {
        return document.getElementById(id);
    });
    // ---- Field checks, the same rules as apps-script/common.gs (the scripts check again) ----
    // Free text keeps letters and accents in any language, digits, whitespace and everyday punctuation;
    // anything else (symbols, emoji, angle brackets, control characters) is removed before sending.
    var unsafeText = /[^\p{L}\p{M}\p{N}\s.,!?'"\u2018\u2019\u201C\u201D()\-\u2013\u2014:;&/#+%]/gu;
    var namePattern = /^[\p{L}\p{M}][\p{L}\p{M} '\u2019.,&-]*$/u;
    var emailPattern = /^[^\s@,;:<>()[\]\\"']+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$/;
    var phonePattern = /^\+?[0-9 ().-]+$/;

    function safeText(value, max, multiline) {
        var text = String(value).normalize('NFC').replace(/\r\n?/g, '\n').replace(unsafeText, '');
        text = multiline
            ? text
                  .replace(/[^\S\n]+/g, ' ')
                  .replace(/ *\n */g, '\n')
                  .replace(/\n{3,}/g, '\n\n')
            : text.replace(/\s+/g, ' ');
        return text.trim().slice(0, max);
    }

    // The value a field sends: free text cut down to safe characters, everything else trimmed.
    function fieldValue(field) {
        var kind = field.dataset.kind;
        if (kind === 'line' || kind === 'text') return safeText(field.value, field.maxLength > 0 ? field.maxLength : 2000, kind === 'text');
        return field.value.trim();
    }

    // '' when the field is fine, 'empty' when a required field is blank, 'invalid' otherwise.
    function fieldProblem(field) {
        var value = fieldValue(field);
        // A number field reads as empty when what was typed isn't a number at all.
        if (field.validity && field.validity.badInput) return 'invalid';
        if (!value) return field.required ? 'empty' : '';
        if (field.maxLength > 0 && value.length > field.maxLength) return 'invalid';
        if (field.dataset.kind === 'name') return namePattern.test(value.normalize('NFC')) ? '' : 'invalid';
        if (field.type === 'email') return emailPattern.test(value) && value.length <= 254 ? '' : 'invalid';
        if (field.type === 'tel') {
            var digits = value.replace(/\D/g, '').length;
            return phonePattern.test(value) && digits >= 7 && digits <= 15 ? '' : 'invalid';
        }
        if (field.type === 'number') {
            var n = Number(value);
            return /^\d{1,4}$/.test(value) && n >= Number(field.min) && n <= Number(field.max) ? '' : 'invalid';
        }
        if (field.type === 'date') {
            var day = new Date(value + 'T00:00:00');
            return /^\d{4}-\d{2}-\d{2}$/.test(value) && !isNaN(day) && (!field.min || value >= field.min) ? '' : 'invalid';
        }
        if (field.tagName === 'SELECT') {
            return Array.prototype.some.call(field.options, function (o) {
                return o.value === value && !o.disabled;
            })
                ? ''
                : 'invalid';
        }
        return '';
    }

    function validateField(field) {
        var problem = fieldProblem(field);
        var ok = !problem;
        var error = document.getElementById(field.id + '-error');
        field.setAttribute('aria-invalid', String(!ok));
        if (ok) field.removeAttribute('aria-describedby');
        else field.setAttribute('aria-describedby', error.id);
        error.textContent = ok ? '' : problem === 'invalid' ? field.dataset.invalid || field.dataset.error : field.dataset.error;
        return ok;
    }

    fields.forEach(function (field) {
        // Validate once someone leaves a field, then live as they fix it.
        field.addEventListener('blur', function () {
            if (field.value) validateField(field);
        });
        field.addEventListener('input', function () {
            if (field.getAttribute('aria-invalid') === 'true') validateField(field);
        });
    });
    document.getElementById('name').addEventListener('input', function (e) {
        signoff.textContent = e.target.value.trim() || 'me';
    });

    // Wish idea chips add a line to the letter
    var wishButtons = Array.prototype.slice.call(form.querySelectorAll('[data-wish]'));
    var message = document.getElementById('message');
    wishButtons.forEach(function (button) {
        button.addEventListener('click', function () {
            var line = 'I would love ' + button.dataset.wish + '.';
            if (message.value.indexOf(line) === -1) {
                var text = message.value.replace(/\s+$/, '');
                message.value = (text ? text + '\n' : '') + line;
                button.classList.add('added');
                if (message.getAttribute('aria-invalid') === 'true') validateField(message);
            }
            message.scrollTop = message.scrollHeight;
        });
    });

    function showStatus(text, isError) {
        status.hidden = false;
        status.textContent = text;
        status.classList.toggle('is-error', !!isError);
    }

    form.addEventListener('submit', function (e) {
        e.preventDefault();
        var invalid = fields.filter(function (f) {
            return !validateField(f);
        });
        if (invalid.length) {
            invalid[0].focus();
            return;
        }

        var data = new URLSearchParams();
        fields.forEach(function (f) {
            data.append(f.name, fieldValue(f));
        });
        data.append('website', document.getElementById('website').value);

        submitButton.disabled = true;
        submitLabel.textContent = 'Sending to the North Pole...';
        status.hidden = true;

        // Apps Script doesn't send CORS headers, so the response is opaque:
        // a resolved fetch means the letter was delivered, a rejection means a network problem.
        fetch(form.action, { method: 'POST', mode: 'no-cors', body: data })
            .then(function () {
                form.reset();
                signoff.textContent = 'me';
                wishButtons.forEach(function (b) {
                    b.classList.remove('added');
                });
                fields.forEach(function (f) {
                    f.removeAttribute('aria-invalid');
                });
                form.dispatchEvent(new CustomEvent('letter:sent', { bubbles: true }));
                showStatus(
                    'Ho ho ho! Your letter slid down the digital chimney and landed on Santa’s desk. Keep an eye on your stocking (and your inbox)!',
                );
            })
            .catch(function () {
                showStatus(
                    'Ho-ho-oh no! Your letter got caught in a snowdrift and didn’t reach the North Pole. Check your connection and try again.',
                    true,
                );
            })
            .finally(function () {
                submitButton.disabled = false;
                submitLabel.textContent = 'Send my letter';
            });
    });

    // ---- Booking requests (a pop-up form for private events and photo shoots, sent like the letter) ----
    var booking = document.getElementById('bookingDialog');
    var bookingForm = document.getElementById('bookingForm');
    var bookingBody = document.getElementById('bookingBody');
    var bookingStatus = document.getElementById('bookingStatus');
    var bookingSubmit = document.getElementById('bookingSubmit');
    var bookingLabel = bookingSubmit.querySelector('.btn-label');
    var bookingPrivate = document.getElementById('bookingPrivate');
    var bookingPhoto = document.getElementById('bookingPhoto');
    var bookingKinds = {
        'private-booking': {
            kind: 'Private appearance',
            title: 'Private booking request',
            intro: 'Tell us about your event and we’ll call you to confirm the details and talk about pricing.',
        },
        'photo-shoot': {
            kind: 'Written In Light ~ Photo and Film',
            title: 'Photo shoot request',
            intro: 'Tell us when you’d like your Christmas portraits with Santa and we’ll get back to you to set a date and time.',
        },
    };
    var bookingFields = [
        'bk-name',
        'bk-phone',
        'bk-email',
        'bk-date',
        'bk-time',
        'bk-type',
        'bk-place',
        'bk-kids',
        'bk-elf',
        'bk-photo',
        'bk-people',
    ].map(function (id) {
        return document.getElementById(id);
    });
    var bookingDate = document.getElementById('bk-date');

    function localDate(d) {
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }

    function showBookingForm() {
        bookingBody.hidden = false;
        bookingStatus.hidden = true;
        bookingStatus.classList.remove('is-error');
    }

    // The photo shoot request leaves out the private-event questions; disabled fields are neither checked nor sent.
    function setBookingKind(type) {
        var copy = bookingKinds[type];
        var isPhoto = type === 'photo-shoot';
        document.getElementById('bookingType').value = type;
        document.getElementById('bookingKind').textContent = copy.kind;
        document.getElementById('bookingTitle').textContent = copy.title;
        document.getElementById('bookingIntro').textContent = copy.intro;
        bookingPrivate.hidden = bookingPrivate.disabled = isPhoto;
        bookingPhoto.hidden = bookingPhoto.disabled = !isPhoto;
        bookingForm.querySelectorAll('[data-private]').forEach(function (el) {
            el.hidden = isPhoto;
        });
        bookingForm.querySelectorAll('[data-photo]').forEach(function (el) {
            el.hidden = !isPhoto;
        });
    }

    // ---- Open times, from Santa's calendar ----
    // The booking script answers GET ?availability=1&date=YYYY-MM-DD with the busy stretches that day
    // (minutes after midnight, Santa's time zone) and how long a booking of this kind lasts.
    var bookingTime = document.getElementById('bk-time');
    var bookingAvailability = document.getElementById('bookingAvailability');
    var firstSlot = 9 * 60;
    var lastSlot = 19 * 60;
    var slotStep = 30;
    var availabilityRequest = 0;
    var fullyBooked = false;

    function clockLabel(minutes) {
        var h = Math.floor(minutes / 60);
        var m = minutes % 60;
        return ((h + 11) % 12) + 1 + ':' + String(m).padStart(2, '0') + (h < 12 ? ' AM' : ' PM');
    }

    function setTimeOptions(options, placeholder, keep) {
        bookingTime.textContent = '';
        bookingTime.appendChild(new Option(placeholder, ''));
        options.forEach(function (o) {
            var option = new Option(o.label, o.value);
            option.disabled = !!o.disabled;
            bookingTime.appendChild(option);
        });
        bookingTime.value = keep || '';
        if ((bookingTime.selectedOptions[0] || {}).disabled) bookingTime.value = '';
    }

    function slotsFor(date, busy, duration) {
        var now = new Date();
        var today = localDate(now) === date;
        var nowMinutes = now.getHours() * 60 + now.getMinutes();
        var slots = [];
        for (var t = firstSlot; t <= lastSlot; t += slotStep) {
            var taken = busy.some(function (b) {
                return t < b[1] && t + duration > b[0];
            });
            var past = today && t <= nowMinutes;
            if (past) continue;
            var hh = String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0');
            slots.push({ value: hh, label: clockLabel(t) + (taken ? ' (booked)' : ''), disabled: taken });
        }
        return slots;
    }

    function setDateError(text) {
        var error = document.getElementById('bk-date-error');
        bookingDate.setAttribute('aria-invalid', String(!!text));
        if (text) bookingDate.setAttribute('aria-describedby', error.id);
        else bookingDate.removeAttribute('aria-describedby');
        error.textContent = text;
    }

    function loadAvailability() {
        var date = bookingDate.value;
        var keep = bookingTime.value;
        var request = ++availabilityRequest;
        fullyBooked = false;
        bookingAvailability.textContent = '';
        if (!date) {
            setTimeOptions([], 'Pick a date first');
            return;
        }
        setTimeOptions([], 'Checking Santa’s calendar...');
        var url =
            bookingForm.action +
            '?availability=1&date=' +
            encodeURIComponent(date) +
            '&formType=' +
            encodeURIComponent(document.getElementById('bookingType').value);
        fetch(url)
            .then(function (response) {
                if (!response.ok) throw new Error('availability ' + response.status);
                return response.json();
            })
            .then(function (info) {
                if (request !== availabilityRequest) return;
                var slots = slotsFor(date, info.busy || [], info.duration || 60);
                var open = slots.filter(function (s) {
                    return !s.disabled;
                });
                if (!open.length) {
                    fullyBooked = true;
                    setTimeOptions([], 'No open times that day');
                    setDateError('Santa is fully booked that day. Please pick another date.');
                    return;
                }
                if (bookingDate.getAttribute('aria-invalid') === 'true') validateField(bookingDate);
                setTimeOptions(slots, 'Pick a time', keep);
                bookingAvailability.textContent = 'Times already booked on Santa’s calendar are greyed out.';
            })
            .catch(function () {
                if (request !== availabilityRequest) return;
                // Without the calendar, offer every time and confirm it on the phone instead.
                setTimeOptions(slotsFor(date, [], 0), 'Pick a time', keep);
                bookingAvailability.textContent =
                    'We couldn’t check Santa’s calendar just now, so we’ll confirm the time when we get back to you.';
            });
    }

    bookingDate.addEventListener('change', loadAvailability);

    document.querySelectorAll('[data-booking]').forEach(function (button) {
        button.addEventListener('click', function () {
            if (document.getElementById('bookingType').value !== button.dataset.booking) {
                bookingForm.reset();
                bookingFields.forEach(function (f) {
                    f.removeAttribute('aria-invalid');
                    f.removeAttribute('aria-describedby');
                    document.getElementById(f.id + '-error').textContent = '';
                });
            }
            setBookingKind(button.dataset.booking);
            bookingDate.min = localDate(new Date());
            loadAvailability();
            showBookingForm();
            if (typeof booking.showModal === 'function') booking.showModal();
            else booking.setAttribute('open', '');
            bookingFields[0].focus();
        });
    });
    document.getElementById('bookingClose').addEventListener('click', function () {
        booking.close();
    });

    bookingFields.forEach(function (field) {
        var event = field.tagName === 'SELECT' ? 'change' : 'input';
        field.addEventListener('blur', function () {
            if (field.value) validateField(field);
        });
        field.addEventListener(event, function () {
            if (field.getAttribute('aria-invalid') === 'true') validateField(field);
        });
    });

    bookingForm.addEventListener('submit', function (e) {
        e.preventDefault();
        var invalid = bookingFields.filter(function (f) {
            return !f.matches(':disabled') && !validateField(f);
        });
        if (fullyBooked) {
            setDateError('Santa is fully booked that day. Please pick another date.');
            if (invalid.indexOf(bookingDate) === -1) invalid.unshift(bookingDate);
        }
        if (invalid.length) {
            invalid[0].focus();
            return;
        }

        var data = new URLSearchParams(new FormData(bookingForm));
        bookingForm.querySelectorAll('[data-kind]').forEach(function (field) {
            if (!field.matches(':disabled')) data.set(field.name, fieldValue(field));
        });

        bookingSubmit.disabled = true;
        bookingLabel.textContent = 'Sending your request...';
        bookingStatus.hidden = true;

        // Same as the letter: Apps Script answers without CORS headers, so the response is opaque.
        fetch(bookingForm.action, { method: 'POST', mode: 'no-cors', body: data })
            .then(function () {
                var type = document.getElementById('bookingType').value;
                bookingForm.reset();
                document.getElementById('bookingType').value = type;
                loadAvailability();
                bookingFields.forEach(function (f) {
                    f.removeAttribute('aria-invalid');
                });
                bookingBody.hidden = true;
                bookingStatus.classList.remove('is-error');
                bookingStatus.textContent = 'Ho ho ho! Your request is on its way. We’ll be in touch soon to confirm the details.';
                bookingStatus.hidden = false;
            })
            .catch(function () {
                bookingStatus.textContent = 'Ho-ho-oh no! Your request didn’t go through. Check your connection and try again.';
                bookingStatus.classList.add('is-error');
                bookingStatus.hidden = false;
            })
            .finally(function () {
                bookingSubmit.disabled = false;
                bookingLabel.textContent = 'Send my request';
            });
    });
})();

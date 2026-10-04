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
    var emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    function validateField(field) {
        var value = field.value.trim();
        var ok = value.length > 0 && (field.type !== 'email' || emailPattern.test(value));
        var error = document.getElementById(field.id + '-error');
        field.setAttribute('aria-invalid', String(!ok));
        if (ok) field.removeAttribute('aria-describedby');
        else field.setAttribute('aria-describedby', error.id);
        error.textContent = ok ? '' : field.dataset.error;
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
        data.append('name', fields[0].value.trim());
        data.append('email', fields[1].value.trim());
        data.append('message', fields[2].value.trim());
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
})();

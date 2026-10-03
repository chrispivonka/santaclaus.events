// Santa Claus Events: small, dependency-free page scripts.
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
        try { localStorage.setItem('site-theme', next); } catch (e) {}
    });

    // ---- Mobile menu ----
    var navToggle = document.getElementById('navToggle');
    var navLinks = document.getElementById('navLinks');
    function setMenu(open) {
        navLinks.classList.toggle('open', open);
        navToggle.setAttribute('aria-expanded', String(open));
    }
    navToggle.addEventListener('click', function () { setMenu(!navLinks.classList.contains('open')); });
    navLinks.addEventListener('click', function (e) { if (e.target.closest('a')) setMenu(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setMenu(false); });

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
        navLinks.querySelectorAll('a[href^="#"]').forEach(function (a) { links[a.getAttribute('href').slice(1)] = a; });
        var spy = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                var link = links[entry.target.id];
                if (link && entry.isIntersecting) {
                    Object.keys(links).forEach(function (k) { links[k].removeAttribute('aria-current'); });
                    link.setAttribute('aria-current', 'true');
                }
            });
        }, { rootMargin: '-45% 0px -50% 0px' });
        Object.keys(links).forEach(function (id) {
            var section = document.getElementById(id);
            if (section) spy.observe(section);
        });
    }

    // ---- Christmas countdown (visitor's local time) ----
    var countdown = document.getElementById('countdown');
    var countdownTitle = document.getElementById('countdownTitle');
    var units = {};
    countdown.querySelectorAll('[data-unit]').forEach(function (el) { units[el.dataset.unit] = el; });
    function setTitle(text, isChristmas) {
        if (countdownTitle.textContent === text) return;
        countdownTitle.textContent = text;
        countdown.classList.toggle('is-christmas', isChristmas);
    }
    function pad(n) { return String(n).padStart(2, '0'); }
    function tick() {
        var now = new Date();
        var year = now.getFullYear();
        // All of Christmas Day is celebrated; the countdown restarts on the 26th.
        if (now.getMonth() === 11 && now.getDate() === 25) {
            setTitle('Merry Christmas!', true);
            return;
        }
        setTitle('Countdown to Christmas', false);
        var target = new Date(year, 11, 25);
        if (now > target) target = new Date(year + 1, 11, 25);
        var diff = Math.max(0, target - now);
        units.days.textContent = Math.floor(diff / 864e5);
        units.hours.textContent = pad(Math.floor(diff / 36e5) % 24);
        units.minutes.textContent = pad(Math.floor(diff / 6e4) % 60);
        units.seconds.textContent = pad(Math.floor(diff / 1e3) % 60);
    }
    tick();
    setInterval(tick, 1000);
    // Screen readers shouldn't hear every second tick; only announce on changes to the title.
    countdown.querySelector('.countdown-units').setAttribute('aria-hidden', 'true');
    countdown.setAttribute('aria-label', 'Countdown to Christmas');

    // ---- Show the events calendar in the visitor's own time zone ----
    try {
        var iframe = document.getElementById('calendarEmbed');
        var tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (iframe && tz) {
            var url = new URL(iframe.getAttribute('src'));
            if (url.searchParams.get('ctz') !== tz) {
                url.searchParams.set('ctz', tz);
                iframe.src = url.toString();
            }
        }
    } catch (e) {}

    // ---- Footer year ----
    document.getElementById('year').textContent = new Date().getFullYear();

    // ---- Letter to Santa form ----
    var form = document.getElementById('letterForm');
    var submitButton = document.getElementById('submitButton');
    var submitLabel = submitButton.querySelector('.btn-label');
    var status = document.getElementById('formStatus');
    var signoff = document.getElementById('signoffName');
    var fields = ['name', 'email', 'message'].map(function (id) { return document.getElementById(id); });
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
        field.addEventListener('blur', function () { if (field.value) validateField(field); });
        field.addEventListener('input', function () {
            if (field.getAttribute('aria-invalid') === 'true') validateField(field);
        });
    });
    document.getElementById('name').addEventListener('input', function (e) {
        signoff.textContent = e.target.value.trim() || 'me';
    });

    function showStatus(message, isError) {
        status.hidden = false;
        status.textContent = message;
        status.classList.toggle('is-error', !!isError);
    }

    form.addEventListener('submit', function (e) {
        e.preventDefault();
        var invalid = fields.filter(function (f) { return !validateField(f); });
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
                fields.forEach(function (f) { f.removeAttribute('aria-invalid'); });
                showStatus('Ho ho ho! Your letter slid down the digital chimney and landed on Santa’s desk. Keep an eye on your stocking (and your inbox)!');
            })
            .catch(function () {
                showStatus('Ho-ho-oh no! Your letter got caught in a snowdrift and didn’t reach the North Pole. Check your connection and try again.', true);
            })
            .finally(function () {
                submitButton.disabled = false;
                submitLabel.textContent = 'Send my letter';
            });
    });

    // ---- Gentle snowfall on a single canvas (skipped for reduced motion) ----
    var canvas = document.getElementById('snow');
    if (reduceMotion || !canvas.getContext) {
        canvas.remove();
        return;
    }
    var ctx = canvas.getContext('2d');
    var flakes = [];
    var width = 0, height = 0, dpr = 1;
    function resize() {
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        width = window.innerWidth;
        height = window.innerHeight;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        var target = Math.round(Math.min(70, width / 18));
        while (flakes.length < target) flakes.push(makeFlake(true));
        flakes.length = target;
    }
    function makeFlake(anywhere) {
        return {
            x: Math.random() * width,
            y: anywhere ? Math.random() * height : -10,
            r: Math.random() * 2.2 + 0.8,
            speed: Math.random() * 0.6 + 0.35,
            drift: Math.random() * 0.6 - 0.3,
            phase: Math.random() * Math.PI * 2,
            alpha: Math.random() * 0.5 + 0.4
        };
    }
    function frame(t) {
        ctx.clearRect(0, 0, width, height);
        var color = root.getAttribute('data-theme') === 'light' ? '150, 170, 200' : '255, 255, 255';
        for (var i = 0; i < flakes.length; i++) {
            var f = flakes[i];
            f.y += f.speed;
            f.x += f.drift + Math.sin(t / 1600 + f.phase) * 0.3;
            if (f.y > height + 10 || f.x < -10 || f.x > width + 10) { flakes[i] = makeFlake(false); continue; }
            ctx.beginPath();
            ctx.fillStyle = 'rgba(' + color + ',' + f.alpha + ')';
            ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
            ctx.fill();
        }
        requestAnimationFrame(frame);
    }
    window.addEventListener('resize', resize);
    resize();
    requestAnimationFrame(frame);
})();

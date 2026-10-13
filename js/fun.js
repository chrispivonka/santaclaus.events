// Santa Claus Events: the playful extras. Snow and confetti, twinkling lights,
// the flying sleigh, North Pole status, advent calendar, games and sounds.
// Everything here is decoration: the page works fine if this file never loads.
(function () {
    'use strict';

    var root = document.documentElement;
    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    function $(id) {
        return document.getElementById(id);
    }
    function load(key) {
        try {
            return localStorage.getItem(key);
        } catch (e) {
            return null;
        }
    }
    function save(key, value) {
        try {
            localStorage.setItem(key, value);
        } catch (e) {}
    }
    function random(min, max) {
        return Math.random() * (max - min) + min;
    }
    function pick(list) {
        return list[Math.floor(Math.random() * list.length)];
    }
    function hash(text) {
        var h = 0;
        for (var i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0;
        return h;
    }
    function centerOf(el) {
        var r = el.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }

    // ---- Toast messages ----
    var toastEl = $('toast');
    var toastTimer;
    function toast(message) {
        toastEl.textContent = message;
        toastEl.classList.add('show');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(function () {
            toastEl.classList.remove('show');
        }, 3600);
    }

    // ---- Sounds, synthesized with Web Audio so there are no files to download ----
    var audio = null;
    var noiseBuffer = null;
    var soundOn = load('site-sound') === 'on';
    var soundToggle = $('soundToggle');

    function getAudio() {
        if (!audio) {
            var AC = window.AudioContext || window.webkitAudioContext;
            if (!AC) return null;
            audio = new AC();
        }
        if (audio.state === 'suspended') audio.resume();
        return audio;
    }
    function bell(freq, start, length, volume) {
        var ac = audio;
        [1, 2.76, 5.4].forEach(function (partial, i) {
            var osc = ac.createOscillator();
            var gain = ac.createGain();
            osc.type = 'sine';
            osc.frequency.value = freq * partial;
            var v = (volume || 0.18) / (i * 2.5 + 1);
            gain.gain.setValueAtTime(0.0001, start);
            gain.gain.exponentialRampToValueAtTime(v, start + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.0001, start + length / (i + 1));
            osc.connect(gain).connect(ac.destination);
            osc.start(start);
            osc.stop(start + length);
        });
    }
    function sleighBells(start, count) {
        var ac = audio;
        if (!noiseBuffer) {
            noiseBuffer = ac.createBuffer(1, ac.sampleRate * 0.2, ac.sampleRate);
            var data = noiseBuffer.getChannelData(0);
            for (var i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        }
        for (var n = 0; n < count; n++) {
            var t = start + n * 0.07 + Math.random() * 0.02;
            var src = ac.createBufferSource();
            var filter = ac.createBiquadFilter();
            var gain = ac.createGain();
            src.buffer = noiseBuffer;
            filter.type = 'bandpass';
            filter.frequency.value = random(6500, 9500);
            filter.Q.value = 8;
            gain.gain.setValueAtTime(0.35, t);
            gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
            src.connect(filter).connect(gain).connect(ac.destination);
            src.start(t);
            src.stop(t + 0.2);
        }
    }
    function midi(n) {
        return 440 * Math.pow(2, (n - 69) / 12);
    }
    // "Jingle Bells" (public domain): [note, beats]
    var song = [
        [64, 1],
        [64, 1],
        [64, 2],
        [64, 1],
        [64, 1],
        [64, 2],
        [64, 1],
        [67, 1],
        [60, 1.5],
        [62, 0.5],
        [64, 4],
        [65, 1],
        [65, 1],
        [65, 1.5],
        [65, 0.5],
        [65, 1],
        [64, 1],
        [64, 1],
        [64, 0.5],
        [64, 0.5],
        [64, 1],
        [62, 1],
        [62, 1],
        [64, 1],
        [62, 2],
        [67, 2],
    ];
    function play(name) {
        if (!soundOn || !getAudio()) return;
        var t = audio.currentTime + 0.02;
        if (name === 'song') {
            var beat = 0.24;
            song.forEach(function (n) {
                bell(midi(n[0] + 12), t, Math.max(0.4, n[1] * beat * 1.6), 0.16);
                t += n[1] * beat;
            });
            for (var b = 0; b < 12; b++) sleighBells(audio.currentTime + b * beat * 2, 2);
        } else if (name === 'jingle') {
            sleighBells(t, 7);
        } else if (name === 'chime') {
            bell(midi(84), t, 1.2);
            bell(midi(88), t + 0.12, 1.4);
        } else if (name === 'fanfare') {
            [72, 76, 79, 84].forEach(function (n, i) {
                bell(midi(n), t + i * 0.11, 1.4, 0.16);
            });
            sleighBells(t + 0.4, 5);
        } else if (name === 'boop') {
            bell(midi(67), t, 0.4, 0.12);
        }
    }
    function renderSound() {
        soundToggle.setAttribute('aria-pressed', String(soundOn));
        soundToggle.setAttribute('aria-label', soundOn ? 'Turn off Christmas sounds' : 'Turn on Christmas sounds');
    }
    renderSound();
    soundToggle.addEventListener('click', function () {
        soundOn = !soundOn;
        save('site-sound', soundOn ? 'on' : 'off');
        renderSound();
        if (soundOn) {
            play('song');
            toast('🔔 Sleigh bells on! Tap things around the page to hear them.');
        }
    });

    // ---- Snow and confetti, sharing one canvas ----
    var canvas = $('snow');
    var ctx = canvas.getContext && canvas.getContext('2d');
    var snowToggle = $('snowToggle');
    var snowLabel = $('snowToggleLabel');
    var snowOn = load('site-snow') ? load('site-snow') === 'on' : !reduceMotion;
    var flakes = [];
    var confetti = [];
    var blizzard = 1;
    var width = 0,
        height = 0,
        running = false;

    function makeFlake(anywhere) {
        return {
            x: Math.random() * width,
            y: anywhere ? Math.random() * height : -10,
            r: random(0.8, 3),
            speed: random(0.35, 0.95),
            drift: random(-0.3, 0.3),
            phase: random(0, Math.PI * 2),
            alpha: random(0.4, 0.9),
        };
    }
    function flakeTarget() {
        return snowOn || blizzard > 1 ? Math.round(Math.min(70, width / 18) * blizzard) : 0;
    }
    function resize() {
        var dpr = Math.min(window.devicePixelRatio || 1, 2);
        width = window.innerWidth;
        height = window.innerHeight;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    function frame(t) {
        ctx.clearRect(0, 0, width, height);
        var target = flakeTarget();
        while (flakes.length < target) flakes.push(makeFlake(flakes.length < target / 2 && blizzard === 1));
        if (flakes.length > target) flakes.length = target;
        var color = root.getAttribute('data-theme') === 'light' ? '150, 170, 200' : '255, 255, 255';
        var wind = blizzard > 1 ? 2.2 : 0;
        for (var i = 0; i < flakes.length; i++) {
            var f = flakes[i];
            f.y += f.speed * (blizzard > 1 ? 2.4 : 1);
            f.x += f.drift + wind + Math.sin(t / 1600 + f.phase) * 0.3;
            if (f.y > height + 10 || f.x < -20 || f.x > width + 20) {
                flakes[i] = makeFlake(false);
                if (wind) flakes[i].x = Math.random() * width - width * 0.3;
                continue;
            }
            ctx.beginPath();
            ctx.fillStyle = 'rgba(' + color + ',' + f.alpha + ')';
            ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
            ctx.fill();
        }
        for (var j = confetti.length - 1; j >= 0; j--) {
            var c = confetti[j];
            c.vy += 0.18;
            c.vx *= 0.99;
            c.x += c.vx;
            c.y += c.vy;
            c.rot += c.spin;
            c.life -= 1;
            if (c.life <= 0 || c.y > height + 20) {
                confetti.splice(j, 1);
                continue;
            }
            ctx.save();
            ctx.globalAlpha = Math.min(1, c.life / 40);
            ctx.translate(c.x, c.y);
            ctx.rotate(c.rot);
            ctx.fillStyle = c.color;
            if (c.star) {
                ctx.font = c.size * 2 + 'px serif';
                ctx.fillText('★', -c.size, c.size);
            } else {
                ctx.fillRect(-c.size / 2, -c.size / 4, c.size, c.size / 2);
            }
            ctx.restore();
        }
        if (flakes.length || confetti.length) requestAnimationFrame(frame);
        else {
            running = false;
            ctx.clearRect(0, 0, width, height);
        }
    }
    function startCanvas() {
        if (!ctx || running) return;
        running = true;
        requestAnimationFrame(frame);
    }
    function burst(x, y, count) {
        if (!ctx || reduceMotion) return;
        var colors = ['#c8102e', '#1f9c5f', '#e0b052', '#ffffff', '#4ab3ff', '#ff6b80'];
        for (var i = 0; i < (count || 80); i++) {
            var angle = random(0, Math.PI * 2);
            var speed = random(2, 9);
            confetti.push({
                x: x,
                y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 4,
                rot: random(0, 6),
                spin: random(-0.3, 0.3),
                size: random(6, 11),
                color: pick(colors),
                star: Math.random() < 0.2,
                life: random(70, 120),
            });
        }
        startCanvas();
    }
    function renderSnowToggle() {
        snowToggle.setAttribute('aria-pressed', String(snowOn));
        snowLabel.textContent = snowOn ? 'Snow on' : 'Snow off';
    }
    if (ctx) {
        window.addEventListener('resize', resize);
        resize();
        if (snowOn) startCanvas();
        renderSnowToggle();
        snowToggle.addEventListener('click', function () {
            snowOn = !snowOn;
            save('site-snow', snowOn ? 'on' : 'off');
            renderSnowToggle();
            if (snowOn) startCanvas();
        });
    } else {
        canvas.remove();
        snowToggle.hidden = true;
    }

    // ---- String of lights under the header ----
    var lights = $('lights');
    function hangLights() {
        var count = Math.ceil(window.innerWidth / 56) + 1;
        if (lights.children.length === count) return;
        lights.textContent = '';
        for (var i = 0; i < count; i++) {
            var bulb = document.createElement('li');
            bulb.style.setProperty('--d', (-random(0, 2.4)).toFixed(2) + 's');
            lights.appendChild(bulb);
        }
    }
    hangLights();
    var lightsTimer;
    window.addEventListener('resize', function () {
        clearTimeout(lightsTimer);
        lightsTimer = setTimeout(hangLights, 200);
    });

    // ---- Stars in the night sky ----
    var stars = $('stars');
    for (var s = 0; s < 70; s++) {
        var star = document.createElement('span');
        star.className = 'star';
        star.style.left = random(0, 100).toFixed(2) + '%';
        star.style.top = random(0, 100).toFixed(2) + '%';
        star.style.setProperty('--s', random(1, 3).toFixed(1) + 'px');
        star.style.setProperty('--d', (-random(0, 3)).toFixed(2) + 's');
        stars.appendChild(star);
    }

    // ---- The flying sleigh ----
    var sleigh = $('sleigh');
    function floatAt(className, text, x, y) {
        var el = document.createElement('span');
        el.className = className;
        el.textContent = text;
        el.style.left = x + 'px';
        el.style.top = y + 'px';
        document.body.appendChild(el);
        el.addEventListener('animationend', function () {
            el.remove();
        });
        setTimeout(function () {
            el.remove();
        }, 4000);
        return el;
    }
    function dashSleigh() {
        if (reduceMotion) return;
        sleigh.classList.remove('dash');
        void sleigh.offsetWidth;
        sleigh.classList.add('dash');
    }
    sleigh.addEventListener('animationend', function () {
        sleigh.classList.remove('dash');
    });
    sleigh.addEventListener('click', function () {
        var p = centerOf(sleigh);
        floatAt('ho-bubble', pick(['Ho ho ho!', 'Merry Christmas!', 'Ho ho ho!', 'On, Dasher!']), p.x, p.y - 30);
        ['🎁', '🎄', '⭐', '🍬'].forEach(function (gift, i) {
            var el = floatAt('gift-drop', gift, p.x - 30 + i * 12, p.y);
            el.style.setProperty('--dx', random(-80, 80).toFixed(0) + 'px');
            el.style.setProperty('--r', random(-260, 260).toFixed(0) + 'deg');
            el.style.animationDelay = i * 0.12 + 's';
        });
        play('jingle');
    });
    $('moon').addEventListener('click', function () {
        dashSleigh();
        play('chime');
        toast(
            pick([
                '🌙 Santa is taking a practice lap around the moon!',
                '🌙 The moon winks back at you.',
                '🌙 Rudolph says hi from up here!',
            ]),
        );
    });

    // ---- Live status from the North Pole (all made up from today's date) ----
    (function () {
        var now = new Date();
        var y = now.getFullYear(),
            m = now.getMonth(),
            d = now.getDate();
        var statusText, sub;
        if (m === 11 && d === 24) {
            statusText = 'delivering presents!';
            sub = 'Follow his trip around the world on the NORAD Santa Tracker.';
        } else if (m === 11 && d === 25) {
            statusText = 'taking a well-earned nap';
            sub = 'Every present has been delivered. Merry Christmas!';
        } else if (m === 11 && d > 25) {
            statusText = 'relaxing with a mug of cocoa';
            sub = 'The reindeer are on vacation until New Year’s.';
        } else if (m === 11) {
            statusText = 'checking his list twice';
            sub = 'Santa is out visiting families. Come say hello!';
        } else if (m === 10) {
            statusText = 'making his list';
            sub = 'Letters are pouring in. Have you sent yours yet?';
        } else if (m >= 8) {
            statusText = 'running the workshop at full speed';
            sub = 'Hammers are tapping and paint is drying all over the North Pole.';
        } else if (m >= 6) {
            statusText = 'testing toys in the workshop';
            sub = 'Somebody has to make sure the yo-yos actually yo.';
        } else if (m >= 2) {
            statusText = 'dreaming up new toys';
            sub = 'The elves are sketching ideas for next Christmas.';
        } else {
            statusText = 'on vacation in the snow';
            sub = 'Even Santa needs a break! The elves are tidying the workshop.';
        }
        $('santaStatus').textContent = statusText;
        $('santaStatusSub').textContent = sub;

        // How far through the year's toy-making we are: Dec 26 last year to Dec 24.
        var start = new Date(m === 11 && d > 25 ? y : y - 1, 11, 26);
        var end = new Date(start.getFullYear() + 1, 11, 24);
        var p = Math.min(1, Math.max(0, (now - start) / (end - start)));
        if (m === 11 && (d === 24 || d === 25)) p = 1;
        var values = {
            toys: Math.pow(p, 0.8),
            reindeer: p < 0.7 ? p * 0.5 : 0.35 + ((p - 0.7) / 0.3) * 0.65,
            cookies: Math.min(1, p * 1.25),
            sleigh: Math.pow(p, 3),
        };
        document.querySelectorAll('.meter').forEach(function (meter) {
            var v = Math.round(Math.min(1, values[meter.dataset.meter]) * 100);
            meter.querySelector('.meter-fill').style.setProperty('--v', v + '%');
            meter.dataset.value = v;
        });
    })();
    function countUpMeters() {
        document.querySelectorAll('.meter').forEach(function (meter) {
            var el = meter.querySelector('.meter-value');
            var target = Number(meter.dataset.value);
            if (reduceMotion) {
                el.textContent = target + '%';
                return;
            }
            var t0 = performance.now();
            (function step(t) {
                var k = Math.min(1, (t - t0) / 1600);
                el.textContent = Math.round(target * (1 - Math.pow(1 - k, 3))) + '%';
                if (k < 1) requestAnimationFrame(step);
            })(t0);
        });
    }

    // ---- Content eases in as it scrolls into view ----
    var reveals = document.querySelectorAll('.reveal');
    function revealed(el) {
        el.classList.add('in');
        if (el.classList.contains('status-board')) countUpMeters();
    }
    if ('IntersectionObserver' in window) {
        var io = new IntersectionObserver(
            function (entries) {
                entries.forEach(function (entry) {
                    if (entry.isIntersecting) {
                        revealed(entry.target);
                        io.unobserve(entry.target);
                    }
                });
            },
            { rootMargin: '0px 0px -8% 0px' },
        );
        reveals.forEach(function (el) {
            io.observe(el);
        });
    } else {
        reveals.forEach(revealed);
    }

    // ---- Advent calendar ----
    var advent = [
        { icon: '🎶', kind: 'joke', title: 'What do you call an elf who sings?', answer: 'A wrapper!' },
        {
            icon: '❄️',
            kind: 'activity',
            title: 'Make a paper snowflake',
            text: 'Fold a square of paper into a triangle three times, snip little shapes along the edges, and unfold. No two snowflakes are the same!',
        },
        {
            icon: '🦌',
            kind: 'fact',
            title: 'Reindeer have super eyes',
            text: 'Reindeer can see ultraviolet light, which helps them spot food and friends in the bright Arctic snow.',
        },
        { icon: '🌱', kind: 'joke', title: 'What does Santa say when he’s gardening?', answer: 'Hoe, hoe, hoe!' },
        {
            icon: '💛',
            kind: 'activity',
            title: 'Three good things',
            text: 'Tell a grown-up three things you’re thankful for today. Santa loves a grateful heart.',
        },
        {
            icon: '👞',
            kind: 'fact',
            title: 'Happy St. Nicholas Day!',
            text: 'In many countries, children leave their shoes out tonight, December 6th, and wake up to find little treats inside.',
        },
        { icon: '🍪', kind: 'joke', title: 'Why did the gingerbread man go to the doctor?', answer: 'He was feeling crummy!' },
        {
            icon: '💃',
            kind: 'activity',
            title: 'The reindeer hop',
            text: 'Do nine big hops, one for each reindeer: Dasher, Dancer, Prancer, Vixen, Comet, Cupid, Donner, Blitzen and Rudolph!',
        },
        {
            icon: '🦌',
            kind: 'fact',
            title: 'Antlers for everyone',
            text: 'Reindeer are the only kind of deer where the girls grow antlers too.',
        },
        { icon: '⛄', kind: 'joke', title: 'What do snowmen eat for breakfast?', answer: 'Frosted Flakes!' },
        {
            icon: '✏️',
            kind: 'activity',
            title: 'Design a toy',
            text: 'Draw the most amazing toy you can imagine. Bring it with you when you visit Santa and show him!',
        },
        {
            icon: '🪶',
            kind: 'fact',
            title: 'Feather trees',
            text: 'Some of the very first artificial Christmas trees were made in Germany from goose feathers dyed green.',
        },
        { icon: '🐱', kind: 'joke', title: 'What do you call a cat on the beach at Christmas?', answer: 'Sandy Claws!' },
        {
            icon: '📖',
            kind: 'activity',
            title: 'Story fort night',
            text: 'Build a blanket fort, grab a flashlight, and read a winter story inside it.',
        },
        {
            icon: '🔴',
            kind: 'fact',
            title: 'Rudolph’s birthday',
            text: 'Rudolph the Red-Nosed Reindeer first appeared in a story booklet in 1939. His nose has been glowing ever since.',
        },
        { icon: '📸', kind: 'joke', title: 'How does Santa take pictures?', answer: 'With his North Pole-aroid!' },
        {
            icon: '🧁',
            kind: 'activity',
            title: 'Quality control',
            text: 'Help a grown-up bake cookies. Somebody has to taste-test one to make sure it’s good enough for Santa.',
        },
        {
            icon: '🔬',
            kind: 'fact',
            title: 'Six-sided snow',
            text: 'Snowflakes almost always have six sides because of the way water freezes into ice crystals.',
        },
        { icon: '🧛', kind: 'joke', title: 'What do you get if you cross a snowman and a vampire?', answer: 'Frostbite!' },
        {
            icon: '🎤',
            kind: 'activity',
            title: 'Carol time',
            text: 'Sing your favorite Christmas song as loud as you can (ask a grown-up first!). Christmas cheer spreads by singing loud for all to hear.',
        },
        {
            icon: '🌌',
            kind: 'fact',
            title: 'The longest night',
            text: 'Around December 21st is the winter solstice: the longest night of the year in the northern half of the world. Perfect for sleigh practice!',
        },
        { icon: '🥕', kind: 'joke', title: 'Why was the snowman looking through the carrots?', answer: 'He was picking his nose!' },
        {
            icon: '🥕',
            kind: 'activity',
            title: 'Reindeer snacks',
            text: 'Find a carrot or two to leave out for the reindeer on Christmas Eve. They’ll need the energy!',
        },
        {
            icon: '🛷',
            kind: 'special',
            title: 'Santa leaves tonight!',
            text: 'The sleigh is packed and the reindeer are ready. Hang your stocking, leave out the cookies, and get to bed early. Santa only comes when you’re asleep!',
            link: { href: 'https://www.noradsanta.org/', label: 'Follow Santa’s trip with NORAD' },
        },
    ];
    var kindLabel = { joke: 'Christmas joke', fact: 'North Pole fact', activity: 'Something fun to do', special: 'Christmas Eve' };
    var adventGrid = $('adventGrid');
    var dialog = $('adventDialog');
    var today = new Date();
    var month = today.getMonth(),
        date = today.getDate();
    var adventYear = month === 0 ? today.getFullYear() - 1 : today.getFullYear();
    var opened = {};
    try {
        opened = JSON.parse(load('advent-' + adventYear) || '{}') || {};
    } catch (e) {}

    function isUnlocked(day) {
        if (month === 11) return day <= date;
        return month === 0 && date <= 6; // doors stay open until Epiphany
    }
    function sleepsUntilDecember(day) {
        var target = new Date(today.getFullYear(), 11, day);
        var midnight = new Date(today.getFullYear(), month, date);
        return Math.round((target - midnight) / 864e5);
    }
    function showDoor(day) {
        var item = advent[day - 1];
        $('adventDialogDay').textContent = 'December ' + day + ' · ' + kindLabel[item.kind];
        $('adventDialogIcon').textContent = item.icon;
        $('adventDialogTitle').textContent = item.title;
        var text = $('adventDialogText');
        text.textContent = item.text || 'Can you guess?';
        if (item.link) {
            var a = document.createElement('a');
            a.href = item.link.href;
            a.target = '_blank';
            a.rel = 'noopener';
            a.textContent = item.link.label;
            text.appendChild(document.createElement('br'));
            text.appendChild(document.createElement('br'));
            text.appendChild(a);
        }
        var answer = $('adventDialogAnswer');
        var reveal = $('adventReveal');
        answer.hidden = true;
        answer.textContent = item.answer || '';
        reveal.hidden = !item.answer;
        if (typeof dialog.showModal === 'function') dialog.showModal();
        else dialog.setAttribute('open', '');
        if (item.answer) reveal.focus();
    }
    $('adventReveal').addEventListener('click', function () {
        $('adventDialogAnswer').hidden = false;
        this.hidden = true;
        play('fanfare');
        var p = centerOf($('adventDialogAnswer'));
        burst(p.x, p.y, 50);
    });
    dialog.addEventListener('click', function (e) {
        if (e.target === dialog) dialog.close();
    });

    advent.forEach(function (item, i) {
        var day = i + 1;
        var li = document.createElement('li');
        var door = document.createElement('button');
        door.type = 'button';
        door.className = 'door';
        var unlocked = isUnlocked(day);
        door.setAttribute('aria-label', 'Door ' + day + (unlocked ? '' : ', locked until December ' + day));
        door.innerHTML =
            '<span class="door-inside" aria-hidden="true"></span><span class="door-front" aria-hidden="true"><span class="door-num"></span><span class="door-lock">🔒</span></span>';
        door.querySelector('.door-inside').textContent = item.icon;
        door.querySelector('.door-num').textContent = day;
        if (!unlocked) door.classList.add('is-locked');
        if (month === 11 && day === date) door.classList.add('is-today');
        if (unlocked && opened[day]) door.classList.add('is-open');
        door.addEventListener('click', function () {
            if (!isUnlocked(day)) {
                door.classList.remove('shake');
                void door.offsetWidth;
                door.classList.add('shake');
                play('boop');
                var n = sleepsUntilDecember(day);
                toast(
                    '🔒 No peeking! Door ' +
                        day +
                        ' opens on December ' +
                        day +
                        (n > 0 ? ', ' + n + (n === 1 ? ' sleep' : ' sleeps') + ' from now.' : '.'),
                );
                return;
            }
            if (door.classList.contains('is-open')) {
                showDoor(day);
                return;
            }
            door.classList.add('is-open');
            opened[day] = true;
            save('advent-' + adventYear, JSON.stringify(opened));
            play('chime');
            var p = centerOf(door);
            burst(p.x, p.y, 40);
            setTimeout(
                function () {
                    showDoor(day);
                },
                reduceMotion ? 0 : 550,
            );
        });
        li.appendChild(door);
        adventGrid.appendChild(li);
    });
    var intro = $('adventIntro');
    if (month === 11 && date <= 24)
        intro.textContent =
            'Today is door number ' + date + '. Go on, open it! Behind each door is a joke, a North Pole fact, or something fun to do.';
    else if ((month === 11 && date > 24) || (month === 0 && date <= 6))
        intro.textContent = 'Missed one? Every door stays open until January 6th, so you can catch up on all 24.';
    else
        intro.textContent =
            'The first door opens on December 1st, just ' +
            sleepsUntilDecember(1) +
            ' sleeps away. Behind each one is a joke, a North Pole fact, or something fun to do.';

    // ---- Am I on the Nice List? ----
    var niceForm = $('niceForm');
    var niceInput = $('niceName');
    var scrollPaper = $('niceScroll');
    var scrollNames = $('scrollNames');
    var outcome = $('niceOutcome');
    var gaugeFill = $('gaugeFill');
    var verdict = $('niceVerdict');
    var lastNice = null;
    var listNames = [
        'Ava',
        'Liam',
        'Sofia',
        'Noah',
        'Mia',
        'Lucas',
        'Zoe',
        'Ethan',
        'Lily',
        'Owen',
        'Ella',
        'Leo',
        'Harper',
        'Mateo',
        'Nora',
        'Jack',
        'Ruby',
        'Henry',
    ];
    var niceNotes = [
        'Santa says keep sharing those toys!',
        'The elves noticed how kind you’ve been.',
        'Mrs. Claus says your manners are top notch.',
        'Rudolph gave you a glowing review.',
        'Keep up the good work and keep cleaning your room!',
        'Santa smiled when he read your name.',
    ];
    function titleCase(name) {
        return name.charAt(0).toUpperCase() + name.slice(1);
    }
    niceForm.addEventListener('submit', function (e) {
        e.preventDefault();
        var name = titleCase(niceInput.value.trim().replace(/\s+/g, ' '));
        if (!name) {
            niceInput.focus();
            toast('Santa needs a name to check his list!');
            return;
        }
        var grinch = /grinch/i.test(name);
        var h = hash(name.toLowerCase());
        var score = grinch ? 4 : 90 + (h % 11);
        outcome.hidden = true;
        gaugeFill.style.width = '0';
        scrollNames.textContent = '';
        listNames
            .slice(h % 6, (h % 6) + 10)
            .concat([name])
            .forEach(function (n) {
                var li = document.createElement('li');
                li.textContent = n;
                scrollNames.appendChild(li);
            });
        scrollPaper.hidden = false;
        play('jingle');
        setTimeout(
            function () {
                scrollPaper.hidden = true;
                outcome.hidden = false;
                verdict.textContent = '';
                var b = document.createElement('b');
                b.textContent = name;
                verdict.appendChild(b);
                verdict.appendChild(document.createTextNode(grinch ? ', hmm\u2026' : ', you\u2019re on the Nice List!'));
                $('niceNote').textContent = grinch
                    ? 'Santa is still hoping your heart grows three sizes this year.'
                    : 'You scored ' + score + '% nice. ' + niceNotes[h % niceNotes.length];
                gaugeFill.style.setProperty('--full', (10000 / Math.max(score, 1)).toFixed(0) + '%');
                requestAnimationFrame(function () {
                    gaugeFill.style.width = score + '%';
                });
                $('printCert').hidden = grinch;
                lastNice = { name: name, score: score };
                if (!grinch) {
                    play('fanfare');
                    var p = centerOf(outcome);
                    setTimeout(function () {
                        burst(p.x, p.y, 110);
                    }, 700);
                } else {
                    play('boop');
                }
            },
            reduceMotion ? 50 : 2200,
        );
    });
    $('printCert').addEventListener('click', function () {
        if (!lastNice) return;
        var area = $('printArea');
        var when = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
        area.innerHTML =
            '<div class="certificate"><p class="cert-top">Official North Pole Certificate</p>' +
            '<h1>Nice List</h1><p>This certifies that</p><p class="cert-name"></p>' +
            '<p class="cert-body"></p><p class="cert-seal" aria-hidden="true">🎅</p>' +
            '<div class="cert-sign"><span>Santa Claus<small>Santa Claus</small></span><span class="cert-date"></span></div></div>';
        area.querySelector('.cert-name').textContent = lastNice.name;
        area.querySelector('.cert-body').textContent =
            'has been checked twice and found to be ' +
            lastNice.score +
            '% nice, and is hereby an official member of Santa’s Nice List for Christmas ' +
            adventYear +
            '.';
        var dateEl = area.querySelector('.cert-date');
        dateEl.textContent = when;
        var small = document.createElement('small');
        small.textContent = 'Date';
        dateEl.appendChild(small);
        document.body.classList.add('printing');
        window.print();
    });
    window.addEventListener('afterprint', function () {
        document.body.classList.remove('printing');
    });

    // ---- What's your elf name? ----
    var elfFirst = {
        a: 'Jingle',
        b: 'Sparkle',
        c: 'Twinkle',
        d: 'Cocoa',
        e: 'Snowy',
        f: 'Frosty',
        g: 'Ginger',
        h: 'Holly',
        i: 'Icicle',
        j: 'Jolly',
        k: 'Tinsel',
        l: 'Lucky',
        m: 'Merry',
        n: 'Nutmeg',
        o: 'Ornament',
        p: 'Peppermint',
        q: 'Quilly',
        r: 'Ribbon',
        s: 'Sugarplum',
        t: 'Toasty',
        u: 'Upsy',
        v: 'Velvet',
        w: 'Wiggles',
        x: 'Xylo',
        y: 'Yuletide',
        z: 'Zippy',
    };
    var elfLast = [
        'McSnowflake',
        'Candycane',
        'Gumdrop',
        'Tinseltoes',
        'Sprinkleboots',
        'Cookiecrumb',
        'Mittens',
        'Jinglebottom',
        'Fruitcake',
        'Hollyberry',
        'Cocoabean',
        'Starbright',
    ];
    var elfJobs = [
        'Chief Cookie Tester',
        'Ribbon Curling Specialist',
        'Reindeer Snack Coordinator',
        'Toy Quality Inspector',
        'Sleigh Bell Tuner',
        'Head of Wrapping Paper',
        'Snowball Safety Officer',
        'Candy Cane Straightener',
        'Stocking Stuffer-in-Chief',
        'Workshop DJ',
        'Keeper of the Nice List Pens',
        'Hot Cocoa Barista',
    ];
    $('elfForm').addEventListener('submit', function (e) {
        e.preventDefault();
        var first = $('elfFirst').value.trim();
        var m = $('elfMonth').value;
        if (!first) {
            $('elfFirst').focus();
            toast('Every elf needs a first name to start with!');
            return;
        }
        if (m === '') {
            $('elfMonth').focus();
            toast('Pick your birthday month and the elves will do the rest.');
            return;
        }
        var letter = first.charAt(0).toLowerCase();
        var name = (elfFirst[letter] || 'Jolly') + ' ' + elfLast[Number(m)];
        $('elfName').textContent = name;
        $('elfJob').textContent = 'Job at the workshop: ' + elfJobs[hash(first.toLowerCase() + m) % elfJobs.length];
        var badge = $('elfBadge');
        badge.hidden = true;
        void badge.offsetWidth;
        badge.hidden = false;
        play('chime');
        var p = centerOf(badge);
        burst(p.x, p.y, 50);
    });

    // ---- Reindeer roll call ----
    var reindeer = [
        ['Dasher', 'The fastest starter on the team. Zero to sleigh speed in two hops.'],
        ['Dancer', 'Does a little jig on every rooftop. The elves call it the Chimney Shuffle.'],
        ['Prancer', 'Has the fanciest trot at the North Pole, and knows it.'],
        ['Vixen', 'A clever navigator who never needs a map.'],
        ['Comet', 'Leaves a trail of sparkles across the night sky.'],
        ['Cupid', 'Spreads Christmas cheer everywhere the sleigh lands.'],
        ['Donner', 'The strongest of the team. Pulls the heaviest toy sacks.'],
        ['Blitzen', 'Fast as lightning, especially when carrots are involved.'],
        ['Rudolph', 'Team captain! That glowing red nose lights the way on foggy nights.'],
    ];
    var reindeerGrid = $('reindeerGrid');
    reindeer.forEach(function (r) {
        var li = document.createElement('li');
        var card = document.createElement('button');
        card.type = 'button';
        card.className = 'deer-card' + (r[0] === 'Rudolph' ? ' rudolph' : '');
        card.setAttribute('aria-pressed', 'false');
        card.innerHTML =
            '<span class="deer-face deer-front"><span class="deer-emoji" aria-hidden="true">🦌</span><span class="deer-name"></span></span><span class="deer-face deer-back"></span>';
        card.querySelector('.deer-name').textContent = r[0];
        card.querySelector('.deer-back').textContent = r[1];
        card.addEventListener('click', function () {
            var on = card.getAttribute('aria-pressed') !== 'true';
            card.setAttribute('aria-pressed', String(on));
            if (on) play(r[0] === 'Rudolph' ? 'fanfare' : 'jingle');
        });
        li.appendChild(card);
        reindeerGrid.appendChild(li);
    });

    // ---- A letter on its way: confetti and a little envelope flying off to the North Pole ----
    document.addEventListener('letter:sent', function (e) {
        var form = e.target;
        var button = $('submitButton');
        var p = centerOf(button);
        form.classList.remove('sent');
        void form.offsetWidth;
        form.classList.add('sent');
        play('fanfare');
        burst(p.x, p.y, 140);
        if (!reduceMotion) {
            var env = floatAt('flying-letter', '✉️', p.x - 20, p.y - 20);
            env.style.setProperty('--tx', window.innerWidth - p.x + 'px');
            env.style.setProperty('--ty', -p.y - 40 + 'px');
        }
    });

    // ---- Secret elf code: up up down down left right left right B A ----
    var code = ['arrowup', 'arrowup', 'arrowdown', 'arrowdown', 'arrowleft', 'arrowright', 'arrowleft', 'arrowright', 'b', 'a'];
    var progress = 0;
    var blizzardTimer;
    document.addEventListener('keydown', function (e) {
        var key = (e.key || '').toLowerCase();
        progress = key === code[progress] ? progress + 1 : key === code[0] ? 1 : 0;
        if (progress < code.length) return;
        progress = 0;
        root.classList.add('blizzard');
        blizzard = 5;
        if (ctx) startCanvas();
        dashSleigh();
        play('song');
        toast('❄️ Blizzard mode! The elves are having a snowball fight.');
        clearTimeout(blizzardTimer);
        blizzardTimer = setTimeout(function () {
            blizzard = 1;
            root.classList.remove('blizzard');
        }, 14000);
    });

    // ---- "Santa Claus!" letters drop in, hop now and then, and boing when touched ----
    var accent = document.querySelector('.hero h1 .accent');
    if (accent && !reduceMotion) {
        var label = accent.textContent;
        accent.textContent = '';
        var hiddenLabel = document.createElement('span');
        hiddenLabel.className = 'visually-hidden';
        hiddenLabel.textContent = label;
        var letters = document.createElement('span');
        letters.setAttribute('aria-hidden', 'true');
        Array.prototype.forEach.call(label, function (ch, i) {
            var l = document.createElement('span');
            l.className = 'ltr';
            l.textContent = ch;
            l.style.setProperty('--i', i);
            letters.appendChild(l);
        });
        accent.appendChild(hiddenLabel);
        accent.appendChild(letters);
        accent.classList.add('lettered');
        letters.addEventListener('pointerover', function (e) {
            var l = e.target.closest('.ltr');
            if (!l || l.classList.contains('boing')) return;
            l.classList.add('boing');
            l.addEventListener('animationend', function done() {
                l.classList.remove('boing');
                l.removeEventListener('animationend', done);
            });
            play('boop');
        });
    }

    // ---- The waving snowman ----
    var snowman = $('snowman');
    snowman.addEventListener('click', function () {
        snowman.classList.remove('excited');
        void snowman.offsetWidth;
        snowman.classList.add('excited');
        setTimeout(function () {
            snowman.classList.remove('excited');
        }, 1600);
        var p = centerOf(snowman);
        floatAt('ho-bubble', pick(['Hi there!', 'Brrr!', 'I love hugs!', 'Let it snow!']), p.x, p.y - 50);
        play('chime');
    });

    // ---- A sparkle trail follows the mouse across the hero ----
    var hero = document.querySelector('.hero');
    if (!reduceMotion && window.matchMedia('(pointer: fine)').matches) {
        var lastSpark = 0,
            sparkCount = 0;
        hero.addEventListener('pointermove', function (e) {
            var now = performance.now();
            if (now - lastSpark < 45 || sparkCount > 30) return;
            lastSpark = now;
            sparkCount++;
            var el = floatAt('trail', pick(['✦', '✧', '❄', '⋆', '✦']), e.clientX, e.clientY);
            el.style.setProperty('--c', pick(['#ffe08a', '#ffffff', '#ff8fa0', '#9be7c4', '#a8d8ff']));
            el.style.setProperty('--size', random(10, 20).toFixed(0) + 'px');
            el.style.setProperty('--dx', random(-20, 20).toFixed(0) + 'px');
            el.addEventListener('animationend', function () {
                sparkCount--;
            });
        });
    }

    // ---- Hearts and stars float up while someone writes their letter ----
    var letterBox = $('message');
    var keystrokes = 0;
    if (!reduceMotion) {
        letterBox.addEventListener('input', function () {
            if (++keystrokes % 5) return;
            var r = letterBox.getBoundingClientRect();
            var el = floatAt(
                'type-spark',
                pick(['❤️', '⭐', '✨', '🎄', '💌']),
                r.left + random(r.width * 0.15, r.width * 0.9),
                r.top + random(10, Math.min(r.height, 120)),
            );
            el.style.setProperty('--dx', random(-30, 30).toFixed(0) + 'px');
        });
    }

    // ---- Hide and seek: five friends peek out around the page ----
    var peekers = Array.prototype.slice.call(document.querySelectorAll('.peeker'));
    var seekCount = $('seekCount');
    var found = {};
    try {
        found = JSON.parse(load('seek-found') || '{}') || {};
    } catch (e) {}
    function countFound() {
        return peekers.filter(function (p) {
            return found[p.dataset.name];
        }).length;
    }
    peekers.forEach(function (peeker, i) {
        if (found[peeker.dataset.name]) peeker.classList.add('found');
        // Each friend keeps their own rhythm so they rarely peek at the same time.
        peeker.style.setProperty('--every', 14 + i * 3 + 's');
        peeker.style.setProperty('--delay', (-random(2, 12)).toFixed(1) + 's');
        peeker.addEventListener('click', function () {
            if (found[peeker.dataset.name]) return;
            found[peeker.dataset.name] = true;
            save('seek-found', JSON.stringify(found));
            var p = centerOf(peeker);
            burst(p.x, p.y, 40);
            peeker.classList.add('found');
            var n = countFound();
            seekCount.textContent = n;
            if (n === peekers.length) {
                toast('🎉 You found all five friends! The whole North Pole is cheering for you!');
                play('song');
                burst(window.innerWidth / 2, window.innerHeight / 3, 220);
            } else {
                toast('👀 You found ' + peeker.dataset.name + '! ' + n + ' of ' + peekers.length + ' found.');
                play('fanfare');
            }
        });
    });
    seekCount.textContent = countFound();
})();

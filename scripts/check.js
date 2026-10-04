// Sanity checks on the built site in dist/: config files parse, and every local
// file referenced from the HTML and CSS was actually emitted.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

let bad = 0;
const fail = (msg) => {
    console.error(msg);
    bad++;
};

for (const f of ['vercel.json', 'public/site.webmanifest']) {
    try {
        JSON.parse(readFileSync(f, 'utf8'));
    } catch (e) {
        fail(`${f}: ${e.message}`);
    }
}

const exists = (ref) => existsSync(join('dist', decodeURIComponent(ref.split(/[?#]/)[0])));
const isLocal = (ref) => ref && !/^(https?:|data:|mailto:|tel:|#|\/\/)/.test(ref);

for (const page of ['index.html', '404.html']) {
    const html = readFileSync(join('dist', page), 'utf8');
    if (!html.includes('http-equiv="Content-Security-Policy"')) fail(`${page}: no Content-Security-Policy meta tag`);
    if (/<link rel="stylesheet"/.test(html)) fail(`${page}: stylesheet was not inlined`);
    // url(...) and image-set("...") references in the inlined stylesheet
    for (const [, ref] of html.matchAll(/(?:url\(|image-set\(|\)\s*,|\s)["']?(\/static\/[^"')\s]+)/g)) {
        if (!exists(ref)) fail(`${page}: missing ${ref}`);
    }
    for (const [, attr, value] of html.matchAll(/\s(src|href|srcset)="([^"]*)"/g)) {
        const refs = attr === 'srcset' ? value.split(',').map((s) => s.trim().split(/\s+/)[0]) : [value];
        for (const ref of refs) {
            // Same-page links (/#letter) and the site root are fine; everything else must exist.
            if (!isLocal(ref) || ref === '/' || ref.startsWith('/#')) continue;
            if (!ref.startsWith('/')) fail(`${page}: ${ref} is not root-relative, so it was not processed by the build`);
            else if (!exists(ref)) fail(`${page}: missing ${ref}`);
        }
    }
}

const manifest = JSON.parse(readFileSync('public/site.webmanifest', 'utf8'));
for (const icon of manifest.icons) if (!exists(icon.src)) fail(`site.webmanifest: missing ${icon.src}`);

if (bad) process.exit(1);
console.log('dist looks good');

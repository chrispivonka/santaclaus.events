import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { defineConfig } from 'vite-plus';

// The page's Content Security Policy. The build adds the hashes of the inlined stylesheet
// and theme script, then ships it two ways: as the real header (infra/content-security-policy.txt,
// which the Deploy workflow puts on CloudFront; it's what browsers enforce first and what security
// scanners see) and as a <meta> tag for defense in depth.
const csp = {
    'default-src': ["'self'"],
    'script-src': ["'self'"],
    'style-src': ["'self'"],
    'font-src': ["'self'"],
    'img-src': ["'self'", 'data:'],
    'frame-src': ['https://calendar.google.com'],
    'connect-src': ["'self'", 'https://script.google.com', 'https://script.googleusercontent.com'],
    'form-action': ['https://script.google.com'],
    'base-uri': ["'self'"],
    'object-src': ["'none'"],
    // No script may write markup through innerHTML, document.write or eval-like sinks.
    'require-trusted-types-for': ["'script'"],
    'trusted-types': ["'none'"],
};
// Only valid as a header, so these go in the header policy but not the <meta> tag.
const headerOnly = { 'frame-ancestors': ["'none'"], 'upgrade-insecure-requests': [] };

const sha256 = (text) => `'sha256-${createHash('sha256').update(text).digest('base64')}'`;
const policyText = (policy) =>
    Object.entries(policy)
        .map(([k, v]) => [k, ...v].join(' '))
        .join('; ');

// The theme script has to run before first paint, so it goes straight into the page
// instead of costing a render-blocking request.
const inlineThemeScript = {
    name: 'inline-theme-script',
    apply: 'build',
    transformIndexHtml: {
        order: 'pre',
        handler: (html) =>
            html.replace(
                '<script src="/js/theme-init.js"></script>',
                () => `<script>${readFileSync('js/theme-init.js', 'utf8').trim()}</script>`,
            ),
    },
};

// The stylesheet is small enough (about 10 KB compressed) that inlining it beats a
// separate render-blocking request. Then every inline <script>/<style> gets hashed into the CSP.
// After the build, the union of hashes across pages is written to infra/content-security-policy.txt;
// commit that change (CI fails if the file is out of date with the build).
const inlineCssAndCsp = {
    name: 'inline-css-and-csp',
    apply: 'build',
    transformIndexHtml: {
        order: 'post',
        handler(html, { bundle }) {
            html = html.replace(/<link rel="stylesheet"[^>]*href="\/([^"]+\.css)">/g, (_, file) => `<style>${bundle[file].source}</style>`);
            const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => sha256(m[1]));
            const styles = [...html.matchAll(/<style>([\s\S]*?)<\/style>/g)].map((m) => sha256(m[1]));
            scripts.forEach((h) => seen.script.add(h));
            styles.forEach((h) => seen.style.add(h));
            const policy = { ...csp, 'script-src': [...csp['script-src'], ...scripts], 'style-src': [...csp['style-src'], ...styles] };
            return html.replace(
                /(<meta charset="utf-8"\s*\/?>)/,
                `$1\n    <meta http-equiv="Content-Security-Policy" content="${policyText(policy)}">`,
            );
        },
    },
    closeBundle() {
        const policy = {
            ...csp,
            'script-src': [...csp['script-src'], ...seen.script],
            'style-src': [...csp['style-src'], ...seen.style],
            ...headerOnly,
        };
        const value = policyText(policy);
        if (readFileSync(cspHeaderFile, 'utf8').trim() !== value) {
            writeFileSync(cspHeaderFile, `${value}\n`);
            console.log(`${cspHeaderFile}: Content-Security-Policy header updated to match this build. Commit it.`);
        }
    },
};
const seen = { script: new Set(), style: new Set() };
const cspHeaderFile = 'infra/content-security-policy.txt';

export default defineConfig({
    plugins: [inlineThemeScript, inlineCssAndCsp],

    // `vp lint` (Oxlint): bugs are errors, suspicious patterns are warnings that still fail CI.
    lint: {
        ignorePatterns: ['dist/**', 'playwright-report/**', 'test-results/**'],
        env: { browser: true, es2024: true },
        categories: { correctness: 'error', suspicious: 'warn' },
        // `catch (e) {}` around localStorage and audio is deliberate: those failures are ignorable.
        rules: { 'no-unused-vars': ['error', { caughtErrors: 'none' }] },
    },

    // `vp fmt` (Oxfmt, Prettier-compatible) for JS, CSS, HTML and JSON, matched to the existing style.
    fmt: {
        ignorePatterns: ['dist/**', 'package-lock.json', 'playwright-report/**', 'test-results/**'],
        tabWidth: 4,
        singleQuote: true,
        printWidth: 140,
        overrides: [{ files: ['*.json', '*.yml', '*.yaml', '*.md'], options: { tabWidth: 2 } }],
    },

    // Pre-commit hook (.vite-hooks/pre-commit): format and lint just the staged files.
    staged: {
        '*.{js,css,html,json}': 'vp check --fix',
    },

    build: {
        rollupOptions: {
            input: { main: 'index.html', notFound: '404.html' },
        },
        // Fingerprinted files go in /static so they can be cached forever (see scripts/deploy-aws.js).
        // Unhashed files from public/ (icons, og-image, manifest) keep their normal URLs.
        assetsDir: 'static',
        // Photos and fonts are already compressed; only inline tiny images like the favicon.
        assetsInlineLimit: 1024,
        // The site has no lazily loaded scripts, so the preload polyfill is dead weight.
        modulePreload: { polyfill: false },
    },
});

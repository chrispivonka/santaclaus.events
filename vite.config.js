import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';

// The page's Content Security Policy. It ships as a <meta> tag so the build can add the
// hashes of the inlined stylesheet and theme script; vercel.json adds frame-ancestors,
// which only works as a header.
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
};

const sha256 = (text) => `'sha256-${createHash('sha256').update(text).digest('base64')}'`;

// The theme script has to run before first paint, so it goes straight into the page
// instead of costing a render-blocking request.
const inlineThemeScript = {
    name: 'inline-theme-script',
    apply: 'build',
    transformIndexHtml: {
        order: 'pre',
        handler: (html) => html.replace(
            '<script src="/js/theme-init.js"></script>',
            () => `<script>${readFileSync('js/theme-init.js', 'utf8').trim()}</script>`,
        ),
    },
};

// The stylesheet is small enough (about 10 KB compressed) that inlining it beats a
// separate render-blocking request. Then every inline <script>/<style> gets hashed into the CSP.
const inlineCssAndCsp = {
    name: 'inline-css-and-csp',
    apply: 'build',
    transformIndexHtml: {
        order: 'post',
        handler(html, { bundle }) {
            html = html.replace(/<link rel="stylesheet"[^>]*href="\/([^"]+\.css)">/g, (_, file) => `<style>${bundle[file].source}</style>`);
            const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => sha256(m[1]));
            const styles = [...html.matchAll(/<style>([\s\S]*?)<\/style>/g)].map((m) => sha256(m[1]));
            const policy = { ...csp, 'script-src': [...csp['script-src'], ...scripts], 'style-src': [...csp['style-src'], ...styles] };
            const content = Object.entries(policy).map(([k, v]) => `${k} ${v.join(' ')}`).join('; ');
            return html.replace(/(<meta charset="utf-8"\s*\/?>)/, `$1\n    <meta http-equiv="Content-Security-Policy" content="${content}">`);
        },
    },
};

export default defineConfig({
    plugins: [inlineThemeScript, inlineCssAndCsp],
    build: {
        rollupOptions: {
            input: { main: 'index.html', notFound: '404.html' },
        },
        // Fingerprinted files go in /static so vercel.json can cache them forever.
        // Unhashed files from public/ (icons, og-image, manifest) keep their normal URLs.
        assetsDir: 'static',
        // Photos and fonts are already compressed; only inline tiny images like the favicon.
        assetsInlineLimit: 1024,
        // The site has no lazily loaded scripts, so the preload polyfill is dead weight.
        modulePreload: { polyfill: false },
    },
});

// Builds the self-hosted web fonts in assets/fonts from the @fontsource packages.
// Each font is cut down to the Latin characters the site uses and only the weights it uses,
// which makes them a fraction of the size Google Fonts serves. Fraunces' optical size axis is
// pinned at 72 (tuned for headings), which more than halves its size. Run with `npm run fonts`.
import { readFile, writeFile } from 'node:fs/promises';
import subsetFont from 'subset-font';

// Basic Latin, Latin-1, curly quotes and dashes, bullets, arrows, euro, trademark.
const ranges = [[0x20, 0x7e], [0xa0, 0xff], [0x152, 0x153], [0x2010, 0x2027], [0x2030, 0x203a], [0x20ac, 0x20ac], [0x2122, 0x2122], [0x2190, 0x2193], [0x2212, 0x2212]];
const text = ranges.flatMap(([a, b]) => Array.from({ length: b - a + 1 }, (_, i) => String.fromCodePoint(a + i))).join('');

const fonts = [
    { from: '@fontsource-variable/fraunces/files/fraunces-latin-opsz-normal.woff2', to: 'fraunces.woff2', axes: { opsz: 72, wght: { min: 600, max: 800 } } },
    { from: '@fontsource-variable/inter/files/inter-latin-wght-normal.woff2', to: 'inter.woff2', axes: { wght: { min: 400, max: 700 } } },
    { from: '@fontsource/caveat/files/caveat-latin-600-normal.woff2', to: 'caveat.woff2' },
];

for (const font of fonts) {
    const input = await readFile(new URL(`../node_modules/${font.from}`, import.meta.url));
    const output = await subsetFont(input, text, { targetFormat: 'woff2', variationAxes: font.axes });
    await writeFile(new URL(`../assets/fonts/${font.to}`, import.meta.url), output);
    console.log(`${font.to}: ${(input.length / 1024).toFixed(1)} KB -> ${(output.length / 1024).toFixed(1)} KB`);
}

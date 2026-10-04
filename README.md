# santaclaus.events

Source for the website [santaclaus.events](https://santaclaus.events).

It's a single static page, plain HTML, CSS and JavaScript with no framework. [Vite+](https://viteplus.dev) (Vite 8 with Rolldown, plus Oxlint and Oxfmt) builds it into `dist/`, minifying everything, fingerprinting file names so browsers can cache them for a year, inlining the stylesheet and generating the Content-Security-Policy.

- `index.html`: the page
- `css/styles.css`: all styles (light and dark themes are color tokens at the top)
- `js/main.js`: countdown, theme toggle, mobile menu and the letter form
- `js/fun.js`: the playful extras: snow and confetti, twinkling lights, the flying sleigh, North Pole status board, advent calendar, Nice List checker, elf name generator, reindeer cards, synthesized sleigh-bell sounds, the waving snowman, the hide-and-seek friends that peek out of sections, and the secret blizzard code
- `js/theme-init.js`: applies the saved light/dark choice before the page paints
- `assets/img/`: photos as AVIF and WebP (phone and desktop sizes) with the original JPEG as fallback
- `assets/fonts/`: self-hosted fonts, trimmed to the characters and weights the site uses
- `public/`: files copied as-is with fixed URLs: icons, social preview image, `robots.txt`, `sitemap.xml`, `site.webmanifest`
- `404.html`: the not-found page
- `vite.config.js`: the build, including the Content-Security-Policy

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, commands, the branch and release flow, and what CI checks.

## Updating content

- **Events** come from the embedded public Google Calendar; add events there and they appear on the site.
- **Letters** post to a Google Apps Script web app (the form's `action` URL in `index.html`).
- **About text** is the `about-blurb` paragraph in `index.html`.
- **Advent calendar** doors (jokes, facts and activities) are the `advent` list in `js/fun.js`. Doors unlock by the visitor's local date from December 1st and stay open until January 6th.
- **North Pole status** lines and meters are made up from today's date in `js/fun.js`; edit the wording there.
- **Reindeer talents, elf names and Nice List notes** are plain lists near the bottom of `js/fun.js`.

Sounds are off by default and are synthesized in the browser (no audio files). Everything respects the visitor's reduced-motion setting.

## Deploying

The site is hosted on [Vercel](https://vercel.com) (free Hobby plan) with the GitHub integration:

- Every push to `main` deploys to production at santaclaus.events. `main` only changes through release pull requests (see [Releasing](CONTRIBUTING.md#releasing)).
- Every pull request gets its own preview link, posted on the PR.

Vercel runs `npm run build` and serves `dist/`. `vercel.json` caches fingerprinted files in `/static/` for a year and sets the security headers.

The Content-Security-Policy lives in `vite.config.js` and only allows the outside services the page uses (the Google Calendar embed and the Apps Script letter endpoint). If you add another one, such as analytics or a new embed, add its domain there.

## Checks

Every pull request runs formatting, linting, a build, Playwright tests in three browser engines, accessibility checks, Lighthouse with byte budgets, link checks, dependency review and CodeQL. Details are in [CONTRIBUTING.md](CONTRIBUTING.md#what-ci-checks-on-every-pull-request).

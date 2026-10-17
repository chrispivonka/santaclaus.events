# santaclaus.events

[![CI](https://github.com/chrispivonka/santaclaus.events/actions/workflows/ci.yml/badge.svg?branch=development)](https://github.com/chrispivonka/santaclaus.events/actions/workflows/ci.yml)
[![Security](https://github.com/chrispivonka/santaclaus.events/actions/workflows/security.yml/badge.svg?branch=development)](https://github.com/chrispivonka/santaclaus.events/actions/workflows/security.yml)
[![CodeQL](https://github.com/chrispivonka/santaclaus.events/actions/workflows/codeql.yml/badge.svg?branch=development)](https://github.com/chrispivonka/santaclaus.events/actions/workflows/codeql.yml)
[![Deploy](https://github.com/chrispivonka/santaclaus.events/actions/workflows/deploy.yml/badge.svg)](https://github.com/chrispivonka/santaclaus.events/actions/workflows/deploy.yml)
[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/chrispivonka/santaclaus.events/badge)](https://scorecard.dev/viewer/?uri=github.com/chrispivonka/santaclaus.events)
[![Website](https://img.shields.io/website?url=https%3A%2F%2Fsantaclaus.events&label=santaclaus.events)](https://santaclaus.events)
[![Latest release](https://img.shields.io/github/v/release/chrispivonka/santaclaus.events?sort=date)](https://github.com/chrispivonka/santaclaus.events/releases)
[![License: all rights reserved](https://img.shields.io/badge/license-all_rights_reserved-lightgrey.svg)](LICENSE)
[![WCAG 2.2 AA](https://img.shields.io/badge/accessibility-WCAG_2.2_AA-success)](CONTRIBUTING.md#what-ci-checks-on-every-pull-request)

Source for the website [santaclaus.events](https://santaclaus.events).

It's a single static page, plain HTML, CSS and JavaScript with no framework. [Vite+](https://viteplus.dev) (Vite 8 with Rolldown, plus Oxlint and Oxfmt) builds it into `dist/`, minifying everything, fingerprinting file names so browsers can cache them for a year, inlining the stylesheet and generating the Content-Security-Policy.

- `index.html`: the page
- `css/styles.css`: all styles (light and dark themes are color tokens at the top)
- `js/main.js`: countdown, theme toggle, mobile menu, and the letter and booking forms (with the same field checks the scripts make)
- `js/fun.js`: the playful extras: snow and confetti, twinkling lights, the flying sleigh, North Pole status board, advent calendar, Nice List checker, elf name generator, reindeer cards, synthesized sleigh-bell sounds, the waving snowman, the hide-and-seek friends that peek out of sections, and the secret blizzard code
- `js/theme-init.js`: applies the saved light/dark choice before the page paints
- `assets/img/`: photos as AVIF and WebP (phone and desktop sizes) with the original JPEG as fallback
- `assets/fonts/`: self-hosted fonts, trimmed to the characters and weights the site uses
- `public/`: files copied as-is with fixed URLs: icons, social preview image, `robots.txt`, `sitemap.xml`, `site.webmanifest`
- `404.html`: the not-found page
- `vite.config.js`: the build, including the Content-Security-Policy
- `apps-script/`: the Google Apps Scripts the letter and booking forms post to (released with the site; see its README)
- `infra/`: the AWS CloudFormation template for each environment
- `tests/`: Playwright end-to-end, accessibility, security and script tests

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, commands, the branch and release flow, and what CI checks.

## Updating content

- **Events** come from the embedded public Google Calendar; add events there and they appear on the site.
- **Letters and booking requests** post to Google Apps Script web apps (`apps-script/`). Who receives them is set in each script's properties in Google, never in this repository.
- **About text** is the `about-blurb` paragraph in `index.html`.
- **Advent calendar** doors (jokes, facts and activities) are the `advent` list in `js/fun.js`. Doors unlock by the visitor's local date from December 1st and stay open until January 6th.
- **North Pole status** lines and meters are made up from today's date in `js/fun.js`; edit the wording there.
- **Reindeer talents, elf names and Nice List notes** are plain lists near the bottom of `js/fun.js`.

Sounds are off by default and are synthesized in the browser (no audio files). Everything respects the visitor's reduced-motion setting.

## Deploying

The site is hosted on AWS: a private S3 bucket behind CloudFront for each environment, defined in [`infra/site.yml`](infra/site.yml). GitHub Actions does every deploy, signing in to AWS with a short-lived OIDC role (no stored AWS keys):

- Every push to `development` deploys preprod at https://preview.santaclaus.events.
- Production (santaclaus.events) deploys only from a release tag on `main` (see [Releasing](CONTRIBUTING.md#releasing)).

The Deploy workflow runs `bun run build` and publishes `dist/` with `scripts/deploy-aws.js`, which caches fingerprinted files in `/static/` for a year and keeps the Content-Security-Policy header on CloudFront in step with `infra/content-security-policy.txt`. The other security headers are in the CloudFront response headers policy in `infra/site.yml`.

The Content-Security-Policy lives in `vite.config.js` and only allows the outside services the page uses (the Google Calendar embed and the Apps Script form endpoints). If you add another one, such as analytics or a new embed, add its domain there.

## Checks

Every pull request runs formatting, linting, a build, Playwright tests in three browser engines, accessibility checks, Lighthouse with byte budgets, link checks, dependency, license, lockfile and secret scanning, workflow and infrastructure linting, and CodeQL. Nothing merges without them and the maintainer's merge. Details are in [CONTRIBUTING.md](CONTRIBUTING.md#what-ci-checks-on-every-pull-request).

## Contributing, security and conduct

- [CONTRIBUTING.md](CONTRIBUTING.md): setup, the branch and release flow, and every check a change must pass. Every change goes through a pull request that only the maintainer can merge.
- [SECURITY.md](SECURITY.md): report security problems privately, never in a public issue.
- [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md): this is a family-friendly project; please keep it that way.

## License

All rights reserved: see [LICENSE](LICENSE). The code, photos, written content and the Santa Claus Events name are published here so they can be read and improved through pull requests, not reused elsewhere without permission.

# santaclaus.events

Source for the website [santaclaus.events](https://santaclaus.events).

It's a single static page with no build step:

- `index.html`: the page
- `css/styles.css`: all styles (light and dark themes are color tokens at the top)
- `js/main.js`: countdown, theme toggle, mobile menu, letter form and snowfall
- `js/theme-init.js`: applies the saved light/dark choice before the page paints
- `assets/img/`: photos (WebP with JPEG fallback), icons and social preview image
- `404.html`, `robots.txt`, `sitemap.xml`, `site.webmanifest`: the usual site extras

To preview locally, run `python3 -m http.server` in the repo root and open http://localhost:8000.

## Updating content

- **Events** come from the embedded public Google Calendar; add events there and they appear on the site.
- **Letters** post to a Google Apps Script web app (the form's `action` URL in `index.html`).
- **About text** is the `about-blurb` paragraph in `index.html`.

## Deploying

The site is hosted on [Vercel](https://vercel.com) (free Hobby plan) with the GitHub integration:

- Every push to `main` deploys to production at santaclaus.events.
- Every pull request gets its own preview link, posted on the PR.

There's no build step; `vercel.json` serves the repo root as-is and sets cache and security headers.

The Content-Security-Policy in `vercel.json` only allows the outside services the page uses (Google Fonts, the Google Calendar embed and the Apps Script letter endpoint). If you add another one, such as analytics or a new embed, add its domain there too.

## Checks

`.github/workflows/check.yml` runs on every pull request: it validates the HTML, checks the JSON config files parse, and makes sure every local file the pages reference exists.

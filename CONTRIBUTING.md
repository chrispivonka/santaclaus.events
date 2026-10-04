# Working on santaclaus.events

## Setup

You need Node.js 24 (it includes npm 11). With [nvm](https://github.com/nvm-sh/nvm), run `nvm use` in the repo.

```sh
npm install        # also installs the pre-commit hook
npm run dev        # local site with instant reload
```

| Command | What it does |
|---|---|
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serve `dist/` at http://localhost:4173 |
| `npm run check` | Format check + JavaScript lint (Vite+: Oxfmt and Oxlint) |
| `npm run fmt` | Format everything |
| `npm run lint` | JavaScript, CSS and HTML linting |
| `npm test` | Playwright tests on the built site (run `npm run build` first; `npx playwright install` once) |
| `npm run test:a11y` | Only the accessibility tests |
| `npm run images` | Make AVIF/WebP versions of photos in `assets/img/` |
| `npm run fonts` | Rebuild the trimmed web fonts |

The pre-commit hook formats and lints the files you're committing. Skip it once with `git commit --no-verify`, or turn it off with `npx vp hooks disable`.

## Branches

- **`development`** is where work lands. Open pull requests against it; they're squash-merged.
- **`main`** is production. It only changes through a release pull request from `development`.
- Every pull request gets a Vercel preview link and has to pass the **CI passed** check.

## What CI checks on every pull request

| Job | Checks |
|---|---|
| Format and lint | Oxfmt formatting, Oxlint (JS), Stylelint (CSS), html-validate |
| Workflow security | actionlint and zizmor on `.github/workflows` |
| Build | Vite+ build, then `scripts/check.js` (every referenced file exists, CSP present, CSS inlined) |
| Tests | Playwright on Chromium, Firefox and WebKit (desktop and phone): page, fonts, countdown, theme, calendar, letter form, menu, 404; axe-core accessibility in light and dark themes |
| Lighthouse | 3 runs; performance ≥ 90, best practices ≥ 95, accessibility and SEO 100, no console errors, byte budgets per file type |
| Links | linkinator on internal and outside links |
| Dependency review | Blocks new dependencies with known vulnerabilities |
| CodeQL | Security analysis of the JavaScript and the workflows |

Separately: OpenSSF Scorecard and CodeQL run weekly, a weekly link check of the live site opens an issue if something breaks, and Dependabot proposes grouped dependency updates every Monday (after a 3-day cooldown on new releases).

## Releasing

1. On the **Actions** tab, open **Release** and click **Run workflow**. It opens (or refreshes) a pull request from `development` to `main` listing everything that will ship.
2. Check the list, then merge it with **Create a merge commit** (not squash, so the branches stay in sync).
3. Vercel deploys production. The Release workflow tags a GitHub Release named for the date (for example `v2026.12.01`) with notes grouped by label. The post-deploy check then runs the smoke tests and header checks against the live site.

**Rolling back:** in Vercel, open the previous production deployment and choose **Instant Rollback**. Then revert the bad change on `development` and release again.

## One-time repository settings

These live in GitHub and Vercel settings, not in the code:

1. **Branch rules:** Settings → Rules → Rulesets → New ruleset → **Import a ruleset**, and import `.github/rulesets/main.json`, then `.github/rulesets/development.json`. They require pull requests and the **CI passed** check, block force-pushes and deletion, and block merging with high-severity CodeQL alerts. Admins can still merge their own pull requests without an approval.
2. **Default branch:** Settings → General → Default branch → `development` (recommended), so new pull requests, Dependabot security fixes and Scorecard follow the flow above. Vercel's production branch stays `main`.
3. **Actions:** Settings → Actions → General → Workflow permissions → tick **Allow GitHub Actions to create and approve pull requests** (the Release workflow opens the release pull request).
4. **Security:** Settings → Advanced Security → turn on **Private vulnerability reporting**, **Dependabot alerts**, **Dependabot security updates**, **Secret scanning** and **Push protection**.
5. **Pull requests:** Settings → General → keep **Automatically delete head branches** on. When stacking pull requests, base them on `development` instead of on another pull request's branch. Otherwise GitHub closes the stacked one when the first merges.
6. **Vercel:** Project → Settings → Git → Production branch `main`. Node.js version follows `package.json` (24).
7. **Preview checks (optional):** Vercel → Project → Settings → Deployment Protection → **Protection Bypass for Automation** → create a secret, then add it in GitHub as the repository secret `VERCEL_AUTOMATION_BYPASS_SECRET`. Without it, post-deploy checks run on production only.

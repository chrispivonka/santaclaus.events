# Working on santaclaus.events

## Setup

You need Node.js 24 (it includes npm 11). With [nvm](https://github.com/nvm-sh/nvm), run `nvm use` in the repo.

```sh
npm install        # also installs the pre-commit hook
npm run dev        # local site with instant reload
```

| Command             | What it does                                                                                  |
| ------------------- | --------------------------------------------------------------------------------------------- |
| `npm run build`     | Production build into `dist/`                                                                 |
| `npm run preview`   | Serve `dist/` at http://localhost:4173                                                        |
| `npm run check`     | Format check + JavaScript lint (Vite+: Oxfmt and Oxlint)                                      |
| `npm run fmt`       | Format everything                                                                             |
| `npm run lint`      | JavaScript, CSS and HTML linting                                                              |
| `npm test`          | Playwright tests on the built site (run `npm run build` first; `npx playwright install` once) |
| `npm run test:a11y` | Only the accessibility tests                                                                  |
| `npm run images`    | Make AVIF/WebP versions of photos in `assets/img/`                                            |
| `npm run fonts`     | Rebuild the trimmed web fonts                                                                 |

The Content-Security-Policy is sent as a real header from `vercel.json`, with hashes of the inlined script and styles. The build rewrites that header whenever the hashes change, so if `npm run build` leaves `vercel.json` modified, commit it; CI fails otherwise.

The pre-commit hook formats and lints the files you're committing. Skip it once with `git commit --no-verify`, or turn it off with `npx vp hooks disable`.

## Branches

- **`development`** is where work lands. Open pull requests against it; they're squash-merged. Every push to it deploys **preprod**: https://preprod.santaclaus.events (a Vercel preview deployment aliased to that domain, smoke-tested after each deploy).
- **`main`** is production (https://santaclaus.events). It only changes through a release pull request from `development`, and deploys only from the release tag.
- Every pull request gets a Vercel preview deployment (the Deploy workflow posts the link as a comment) and has to pass the **CI passed** check.

## What CI checks on every pull request

| Job               | Checks                                                                                                                                                                                                                                                                                                                                                             |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Format and lint   | Oxfmt formatting, Oxlint (JS), Stylelint (CSS), html-validate with its accessibility preset                                                                                                                                                                                                                                                                        |
| Workflow security | actionlint and zizmor on `.github/workflows`                                                                                                                                                                                                                                                                                                                       |
| Build             | Vite+ build, then `scripts/check.js` (every referenced file exists, CSS inlined, the CSP in the page and the one in `vercel.json` carry the same hashes)                                                                                                                                                                                                           |
| Tests             | Playwright on Chromium, Firefox and WebKit, desktop and phone. Every feature flow (advent calendar at several dates, countdown, games, letter form and its failure modes), keyboard-only use, layout at 320px and 200% text size, SEO metadata, security (strict CSP with no violations while using everything, no outside requests, honeypot, local storage keys) |
| Accessibility     | axe-core against WCAG 2.2 AA plus best practices in both themes, on every interactive state (menu, dialog, toasts, results, form errors), reduced motion and forced colors; landmarks, live regions, 24px targets                                                                                                                                                  |
| Lighthouse        | 3 runs; performance ≥ 90, best practices ≥ 95, accessibility and SEO 100, no console errors, byte budgets per file type                                                                                                                                                                                                                                            |
| Links             | linkinator on internal and outside links                                                                                                                                                                                                                                                                                                                           |
| Dependency review | Blocks new dependencies with known vulnerabilities                                                                                                                                                                                                                                                                                                                 |
| Security          | OSV-Scanner on the lockfile (reviewed exceptions in `.github/osv-scanner.toml`), `npm audit` as a warning, gitleaks for committed secrets                                                                                                                                                                                                                          |
| Deploy            | Preview deployment to Vercel from GitHub Actions, then the Chromium smoke, accessibility and header tests against it (needs the bypass secret, below)                                                                                                                                                                                                              |
| CodeQL            | Security analysis of the JavaScript and the workflows                                                                                                                                                                                                                                                                                                              |

Separately: OpenSSF Scorecard and CodeQL run weekly, a weekly link check of the live site opens an issue if something breaks, and Dependabot proposes grouped dependency updates every Monday (after a 3-day cooldown on new releases).

## Releasing

Deploys come from GitHub Actions only. Vercel's Git integration is off, so nothing reaches production except through this flow:

1. Check preprod (https://preprod.santaclaus.events), which always shows the current `development`. On the **Actions** tab, open **Release** and click **Run workflow**. It opens (or refreshes) a pull request from `development` to `main` listing everything that will ship.
2. Check the list, then merge it with **Create a merge commit** (not squash, so the branches stay in sync).
3. CI runs on `main`. When it is green, the Release workflow tags a GitHub Release named for the date (for example `v2026.12.01`) with notes grouped by label, and dispatches the **Deploy** workflow with that tag.
4. Deploy checks the tag is on `main`, builds it with `vercel build`, deploys the prebuilt output with `vercel deploy --prebuilt --prod`, then runs the smoke, accessibility and header tests against https://santaclaus.events, followed by an OWASP ZAP baseline scan and the MDN HTTP Observatory (grade A required; findings open an issue).
5. If the smoke tests fail against production, the workflow runs `vercel rollback` to put the previous deployment back and fails loudly. Fix on `development` and release again.

**Deploying by hand:** Actions → **Deploy** → **Run workflow** → enter an existing release tag. Anything that is not a `vYYYY.MM.DD` tag on `main` is refused. To redeploy an older release after a bad one, run it with that older tag.

**Rolling back by hand:** in Vercel, open the previous production deployment and choose **Instant Rollback**, or run the Deploy workflow with the previous tag.

## One-time repository settings

These live in GitHub and Vercel settings, not in the code:

1. **Branch rules:** Settings → Rules → Rulesets → New ruleset → **Import a ruleset**, and import `.github/rulesets/main.json`, then `.github/rulesets/development.json`. They require pull requests and the **CI passed** check, block force-pushes and deletion, and block merging with high-severity CodeQL alerts. Admins can still merge their own pull requests without an approval.
2. **Default branch:** Settings → General → Default branch → `development` (recommended), so new pull requests, Dependabot security fixes and Scorecard follow the flow above. Vercel's production branch stays `main`.
3. **Actions:** Settings → Actions → General → Workflow permissions → tick **Allow GitHub Actions to create and approve pull requests** (the Release workflow opens the release pull request).
4. **Security:** Settings → Advanced Security → turn on **Dependency graph** (the dependency-review check on pull requests is skipped with a warning until it's on), **Private vulnerability reporting**, **Dependabot alerts**, **Dependabot security updates**, **Secret scanning** and **Push protection**.
5. **Pull requests:** Settings → General → keep **Automatically delete head branches** on. When stacking pull requests, base them on `development` instead of on another pull request's branch. Otherwise GitHub closes the stacked one when the first merges.
6. **Vercel project, with the Git integration off:** the project `santaclaus.events` already exists in Vercel. Project → Settings → Git → **Disconnect** the GitHub repository, so Vercel stops building on its own and GitHub Actions is the only deployer (while it is connected, every push deploys twice). Add the domains `santaclaus.events` (and `www`) and `preprod.santaclaus.events` under Settings → Domains (the preprod one needs a `CNAME preprod → cname.vercel-dns.com` record at the DNS provider). Leave the preprod domain unassigned to any Git branch; the Deploy workflow points it at the latest `development` deployment with `vercel alias set`. Vercel sends `X-Robots-Tag: noindex` on non-production deployments, so preprod stays out of search engines.
7. **Vercel secrets in GitHub:** Settings → Secrets and variables → Actions → add `VERCEL_TOKEN` (Vercel → Account Settings → Tokens, scoped to the team, because `vercel pull` reads the team), `VERCEL_PROJECT_ID` (Project → Settings → General → Project ID) and `VERCEL_ORG_ID` (Team → Settings → General → Team ID; both also appear in `.vercel/project.json` after `npx vercel@62 link`). Optionally the repository variables `PRODUCTION_URL` and `PREPROD_URL` if those are not `https://santaclaus.events` and `https://preprod.santaclaus.events`.
8. **Production environment (recommended):** Settings → Environments → `production` → tick **Required reviewers** and add yourself if you want a manual approval before each production deploy; otherwise releases deploy on their own once CI is green on `main`.
9. **Preview checks (optional):** Vercel → Project → Settings → Deployment Protection → **Protection Bypass for Automation** → create a secret, then add it in GitHub as the repository secret `VERCEL_AUTOMATION_BYPASS_SECRET`. Without it, deployment checks run on production only.

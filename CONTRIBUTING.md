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

The Content-Security-Policy is sent as a real header from `infra/content-security-policy.txt` (the Deploy workflow puts it on CloudFront), with hashes of the inlined script and styles. The build rewrites that file whenever the hashes change, so if `npm run build` leaves it modified, commit it; CI fails otherwise.

The pre-commit hook formats and lints the files you're committing. Skip it once with `git commit --no-verify`, or turn it off with `npx vp hooks disable`.

## Branches

- **`development`** is where work lands. Open pull requests against it; they're squash-merged. Every push to it deploys **preprod**: https://preview.santaclaus.events (its own S3 bucket and CloudFront distribution, smoke-tested after each deploy).
- **`main`** is production (https://santaclaus.events). It only changes through a release pull request from `development`, and deploys only from the release tag.
- Every pull request has to pass the **CI passed** check, which builds the site and runs the full test suite against it.

## What CI checks on every pull request

| Job               | Checks                                                                                                                                                                                                                                                                                                                                                             |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Format and lint   | Oxfmt formatting, Oxlint (JS), Stylelint (CSS), html-validate with its accessibility preset                                                                                                                                                                                                                                                                        |
| Workflow security | actionlint and zizmor on `.github/workflows`                                                                                                                                                                                                                                                                                                                       |
| Build             | Vite+ build, then `scripts/check.js` (every referenced file exists, CSS inlined, the CSP in the page and the one in `infra/content-security-policy.txt` carry the same hashes)                                                                                                                                                                                     |
| Tests             | Playwright on Chromium, Firefox and WebKit, desktop and phone. Every feature flow (advent calendar at several dates, countdown, games, letter form and its failure modes), keyboard-only use, layout at 320px and 200% text size, SEO metadata, security (strict CSP with no violations while using everything, no outside requests, honeypot, local storage keys) |
| Accessibility     | axe-core against WCAG 2.2 AA plus best practices in both themes, on every interactive state (menu, dialog, toasts, results, form errors), reduced motion and forced colors; landmarks, live regions, 24px targets                                                                                                                                                  |
| Lighthouse        | 3 runs; performance ≥ 90, best practices ≥ 95, accessibility and SEO 100, no console errors, byte budgets per file type                                                                                                                                                                                                                                            |
| Links             | linkinator on internal and outside links                                                                                                                                                                                                                                                                                                                           |
| Dependency review | Blocks new dependencies with known vulnerabilities                                                                                                                                                                                                                                                                                                                 |
| Security          | OSV-Scanner on the lockfile (reviewed exceptions in `.github/osv-scanner.toml`), `npm audit` as a warning, gitleaks for committed secrets                                                                                                                                                                                                                          |
| CodeQL            | Security analysis of the JavaScript and the workflows                                                                                                                                                                                                                                                                                                              |

Separately: OpenSSF Scorecard and CodeQL run weekly, a weekly link check of the live site opens an issue if something breaks, and Dependabot proposes grouped dependency updates every Monday (after a 3-day cooldown on new releases).

## Releasing

Deploys come from GitHub Actions only, so nothing reaches production except through this flow:

1. Check preprod (https://preview.santaclaus.events), which always shows the current `development`. On the **Actions** tab, open **Release** and click **Run workflow**. It opens (or refreshes) a pull request from `development` to `main` listing everything that will ship.
2. Check the list, then merge it with **Create a merge commit** (not squash, so the branches stay in sync).
3. CI runs on `main`. When it is green, the Release workflow tags a GitHub Release named for the date (for example `v2026.12.01`) with notes grouped by label, and dispatches the **Deploy** workflow with that tag.
4. Deploy checks the tag is on `main`, builds it, publishes `dist/` to the production S3 bucket with `scripts/deploy-aws.js` (files first, then the pages, then a CloudFront invalidation), then runs the smoke, accessibility and header tests against https://santaclaus.events, followed by an OWASP ZAP baseline scan and the MDN HTTP Observatory (grade A required; findings open an issue).
5. If the smoke tests fail against production, the workflow redeploys the previous release and fails loudly. Fix on `development` and release again.

**Deploying by hand:** Actions → **Deploy** → **Run workflow** → enter an existing release tag. Anything that is not a `vYYYY.MM.DD` tag on `main` is refused. To redeploy an older release after a bad one, run it with that older tag.

**Rolling back by hand:** run the Deploy workflow with the previous tag. Every file the bucket held in the last 30 days is also still there as an older S3 object version.

## One-time repository settings

These live in GitHub and AWS settings, not in the code:

1. **Branch rules:** Settings → Rules → Rulesets → New ruleset → **Import a ruleset**, and import `.github/rulesets/main.json`, then `.github/rulesets/development.json`. They require pull requests and the **CI passed** check, block force-pushes and deletion, and block merging with high-severity CodeQL alerts. Admins can still merge their own pull requests without an approval.
2. **Default branch:** Settings → General → Default branch → `development` (recommended), so new pull requests, Dependabot security fixes and Scorecard follow the flow above.
3. **Actions:** Settings → Actions → General → Workflow permissions → tick **Allow GitHub Actions to create and approve pull requests** (the Release workflow opens the release pull request).
4. **Security:** Settings → Advanced Security → turn on **Dependency graph** (the dependency-review check on pull requests is skipped with a warning until it's on), **Private vulnerability reporting**, **Dependabot alerts**, **Dependabot security updates**, **Secret scanning** and **Push protection**.
5. **Pull requests:** Settings → General → keep **Automatically delete head branches** on. When stacking pull requests, base them on `development` instead of on another pull request's branch. Otherwise GitHub closes the stacked one when the first merges.
6. **AWS hosting:** see [AWS setup](#aws-setup) below.
7. **Production environment (recommended):** Settings → Environments → `production` → tick **Required reviewers** and add yourself if you want a manual approval before each production deploy; otherwise releases deploy on their own once CI is green on `main`. (An automatic rollback then also waits for that approval.)

## AWS setup

Everything lives in **us-east-1** (CloudFront only takes certificates from there). DNS for santaclaus.events is a Route 53 hosted zone, because the bare domain has to point at CloudFront with an alias record, which most registrars' DNS cannot do. Each environment is one CloudFormation stack from `infra/site.yml`: a private, versioned S3 bucket, a CloudFront distribution with HTTP/3 and the security headers, its ACM certificate (validated automatically through Route 53), and an IAM role that only that GitHub environment's jobs can assume, and only to publish to that bucket.

1. **Route 53 serves the domain's DNS.** Use the existing hosted zone for santaclaus.events, or create one. If the registrar's nameservers point elsewhere, first copy the current records into the zone, then set the registrar's nameservers to the zone's four NS values, so nothing changes for visitors.
2. **GitHub's OIDC provider, once per AWS account:** `aws iam create-open-id-connect-provider --url https://token.actions.githubusercontent.com --client-id-list sts.amazonaws.com` (an "already exists" error is fine).
3. **The two stacks** (the hosted zone ID is in Route 53 → Hosted zones):

   ```sh
   aws cloudformation deploy --region us-east-1 --capabilities CAPABILITY_IAM \
     --template-file infra/site.yml --stack-name santaclaus-preprod \
     --parameter-overrides EnvironmentName=preprod DomainName=preview.santaclaus.events HostedZoneId=<zone id>

   aws cloudformation deploy --region us-east-1 --capabilities CAPABILITY_IAM \
     --template-file infra/site.yml --stack-name santaclaus-production \
     --parameter-overrides EnvironmentName=production DomainName=santaclaus.events HostedZoneId=<zone id> WwwRedirect=true AttachDomain=false

   aws cloudformation describe-stacks --region us-east-1 --stack-name santaclaus-preprod --query 'Stacks[0].Outputs'
   ```

   `AttachDomain=false` leaves the domain names off the new distribution, because CloudFront refuses a name another distribution still holds (an older site's, here). Step 6 moves them over. Without an older distribution, leave it out.
4. **GitHub environment variables:** Settings → Environments → `preprod`, then `production` → **Environment variables** → add `AWS_ROLE_ARN`, `S3_BUCKET` and `CLOUDFRONT_DISTRIBUTION_ID` from that stack's outputs. No secrets are needed. The repository variables `PREPROD_URL` and `PRODUCTION_URL` say where the post-deploy checks look; until the DNS switch below, set `PRODUCTION_URL` to `https://` plus the production stack's `CloudFrontDomainName`.
5. **First deploys:** re-run the latest Deploy run on `development` for preprod, and run Deploy by hand with the latest release tag for production. Check each on its CloudFront domain name.
6. **Switch DNS** in the Route 53 zone: edit `preview`, the bare domain and `www` into **Alias** A records (and add matching alias AAAA records) pointing at the CloudFront distribution of their stack. Editing a record in place switches it with no gap. Then remove the `PRODUCTION_URL` variable (or set it to `https://santaclaus.events`).

   If production was created with `AttachDomain=false`, move the names over first, with no downtime: add TXT records `_santaclaus.events` and `_www.santaclaus.events` whose value is the production `CloudFrontDomainName`, then run `aws cloudfront associate-alias --target-distribution-id <production distribution id> --alias santaclaus.events` (and again with `--alias www.santaclaus.events`). That takes each name off the old distribution and onto the new one in one step. Switch the DNS records as above, then re-run the production stack deploy with `AttachDomain=true` (a re-run keeps earlier parameter values unless told otherwise) so the stack records the names. The TXT records can go afterwards.

**After updating a stack,** run the Deploy workflow for that environment again: the stack resets the Content-Security-Policy header to a placeholder whenever it updates that policy, and the deploy puts the real one back.

# Security

Please report security problems privately through [GitHub's private vulnerability reporting](https://github.com/chrispivonka/santaclaus.events/security/advisories/new), not in a public issue. Include what you found, how to reproduce it, and what it affects. You'll get a reply within a week, and a fix or a plan within 30 days; you're welcome to be credited in the advisory once it's fixed. Good-faith research that stays within this site, and doesn't touch other people's data or flood the forms, is welcome.

Only the live site at https://santaclaus.events (and its preview at https://preview.santaclaus.events) is supported; fixes ship as a new release from `development`.

## How the site is built

- **Static pages only.** No server code, accounts or cookies. Pages are served from a private S3 bucket through CloudFront (see `infra/site.yml`), which adds HSTS and the rest of the security headers.
- **Strict Content-Security-Policy** with hashed inline code, no outside scripts, and Trusted Types, so no script can turn text into markup (see `vite.config.js`).
- **Forms** (the letter to Santa and the booking requests) post to Google Apps Scripts in `apps-script/`. Each script accepts only the fields its form has, checks every value by type, strips free text down to letters, digits and everyday punctuation, rate-limits by email address and in total, and ignores bots that fill the hidden honeypot field.
- **Personal data:** a letter carries a child's first name and a grown-up's email. It is emailed to Santa's helpers, never stored by the script, and deleted once answered. Booking requests are emailed to the people handling them and, optionally, logged in a private Google Sheet. Nothing is shared or used for marketing.

## How changes are checked

Every pull request must pass CI (lint, build, tests on three browser engines, accessibility, Lighthouse), dependency and secret scanning, workflow and infrastructure linting, and CodeQL before it can merge. Only the maintainer can merge, and production deploys only from release tags on `main`. Details are in [CONTRIBUTING.md](CONTRIBUTING.md).

# Security

Please report security problems privately through [GitHub's private vulnerability reporting](https://github.com/chrispivonka/santaclaus.events/security/advisories/new), not in a public issue. You'll get a reply within a week.

The site is static: no server code, accounts or stored personal data. Letters to Santa go to a Google Apps Script endpoint. The page ships a strict Content-Security-Policy (see `vite.config.js` and `vercel.json`).

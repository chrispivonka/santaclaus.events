# Google Apps Scripts for the site's forms

The site has two forms, and each posts to its own Google Apps Script web app: `booking.gs` for booking requests and `letter.gs` for letters to Santa. Keep them in separate Apps Script projects, and add `common.gs` to each one as a second file (**+** next to Files → Script → name it `common`, then paste in `common.gs`). Both scripts:

- check every field against a fixed type (name, email, phone, date, time, whole number, one of a set list of choices, or free text) and ignore anything else in the request; the site checks the same rules first, so only a request that skipped the site gets turned away;
- cut free text down to letters and accents in any language, digits, spaces and everyday punctuation, removing symbols, emoji, angle brackets and control characters;
- accept only one plain email address, which becomes the email's Reply-To;
- drop anything a bot fills into the hidden honeypot field;
- limit how many requests come in an hour (3 per email address, and 30 bookings or 60 letters in all), so a script posting to the public web app can't use up the account's daily email quota (100 recipients a day on a personal Gmail account, 1,500 on Google Workspace);
- keep recipient addresses in Script Properties, never in this repository.

## Letters to Santa (`letter.gs`)

Letters are emailed to `LETTER_RECIPIENTS` and never stored by the script. The site tells families that the letter is deleted once it's answered, so delete each letter email after replying to it.

Once GitHub is connected to the scripts (see [Changing the scripts](#changing-the-scripts)), releases keep both projects up to date. To switch the live letter form to this script by hand, open the existing letter project at [script.google.com](https://script.google.com), replace its code with `letter.gs`, add `common.gs` as a second file, add the `LETTER_RECIPIENTS` script property, then **Deploy** → **Manage deployments** → edit → Version: **New version** → **Deploy**. The URL stays the same, so the site doesn't change. If the old script did anything else (such as logging to a sheet), compare it with `letter.gs` before you replace it.

## Booking requests (`booking.gs`)

The site's "Request a private booking" and "Request a photo shoot" buttons open one pop-up form that sends each request to a Google Apps Script web app, the same way the letter to Santa form does. The script emails private event requests to the addresses in `PRIVATE_RECIPIENTS` and photo shoot requests to the addresses in `PHOTO_RECIPIENTS`. Those addresses live only in the script's settings in Google, never in this repository or on the site.

## Set it up (once)

1. Signed in to the Google account that should own it (ideally the one that owns the letter script), open [script.google.com](https://script.google.com) and click **New project**. Name it "Santa bookings".
2. Delete the sample code, paste in everything from `booking.gs`, add `common.gs` as a second file, and click **Save**.
3. Click **Project Settings** (gear icon) → **Script Properties** → **Add script property**:
   - `PRIVATE_RECIPIENTS`: who gets private event requests, separated by commas, for example `hanna@example.com,santa@example.com`.
   - `PHOTO_RECIPIENTS`: who gets photo shoot requests, for example `writteninlightphotoandfilm@gmail.com,hanna@example.com`.
   - `CALENDAR_ID`: Santa's calendar, so the form can grey out times that are already booked. The calendar the site shows is `c_4f204d20a0c44782fb0858fa3014913a9168af1cc6fb80a6222ba7aa8619948c@group.calendar.google.com`. The Google account that owns the script must be able to see it (share it with that account if needed).
   - `PRIVATE_MINUTES` and `PHOTO_MINUTES` (optional): how long a private visit and a photo shoot take, in minutes, so the form knows which start times fit. They default to 60 and 30.
   - `SHEET_ID` (optional): to also log requests in a Google Sheet (one tab per kind), create a blank sheet and paste the long ID from its URL (the part between `/d/` and `/edit`).
4. Click **Deploy** → **New deployment** → the gear next to "Select type" → **Web app**:
   - Execute as: **Me**
   - Who has access: **Anyone**
5. Click **Deploy**, allow the permissions Google asks for (sending email as you, reading your calendars, and the sheet if you set one), and copy the **Web app URL**. It looks like `https://script.google.com/macros/s/AKfy.../exec`.
6. Put that URL in the booking form's `action` in `index.html` (the live one is already there; only change it if you make a brand-new deployment).

## How the calendar check works

When someone picks a date, the form asks the script which times that day are already taken on Santa's calendar and greys them out (only the times go to the browser, never event names or details). Requests for 9:00 AM to 7:00 PM, every half hour, are offered; that range is set in `js/main.js`. If two people grab the same time at once, the second request still arrives, with "[Time already booked]" at the start of the subject. If the script can't be reached, the form offers every time and says the time will be confirmed by phone.

## Changing who gets requests

Edit `PRIVATE_RECIPIENTS` or `PHOTO_RECIPIENTS` in Script Properties. No redeploy is needed, and the site doesn't change.

## Changing the scripts

Change the files here and release as usual. When a release changes `common.gs`, `appsscript.json` or a form's script, the Deploy workflow's **Apps Script** job pushes that project with [clasp](https://github.com/google/clasp) and gives its existing deployment a new version, so the URL (and the site) stay the same. Each project gets exactly `common.gs`, its own script and `appsscript.json`; anything else in the project is removed. The job runs only for production releases, because the preview site posts to the same two web apps. A production rollback doesn't roll the scripts back; release a fix instead.

### Connect GitHub to the scripts (once per project)

1. Signed in as the Google account that owns the project, turn on **Google Apps Script API** at [script.google.com/home/usersettings](https://script.google.com/home/usersettings).
2. On your computer, run `bunx @google/clasp@3.4.1 login` and sign in as that same account. It saves a sign-in to `~/.clasprc.json`. It can manage Apps Script projects and the files clasp creates, not read your mail or calendar, and you can revoke it any time at [myaccount.google.com/permissions](https://myaccount.google.com/permissions).
3. On GitHub, open Settings → Environments → `production`:
   - Add a **secret** with the whole contents of `~/.clasprc.json`: `CLASPRC_LETTER` for the letter project, `CLASPRC_BOOKING` for the booking project. If one account owns both, use the same contents for both.
   - Add **variables** `LETTER_SCRIPT_ID` and `BOOKING_SCRIPT_ID` (each project's **Project Settings** → **Script ID**) and `LETTER_DEPLOYMENT_ID` and `BOOKING_DEPLOYMENT_ID` (**Deploy** → **Manage deployments** → the web app's **Deployment ID**, which is the part of the URL between `/s/` and `/exec`).
4. Delete `~/.clasprc.json` (or run `bunx @google/clasp@3.4.1 logout`). GitHub keeps the only copy.

Until a project has its secret and both variables, releases skip it with a notice. To deploy a project by hand, use **Deploy** → **Manage deployments** → edit (pencil) → Version: **New version** → **Deploy**.

If a change makes a script need a new Google permission (for example a new Google service), open the project in the editor once after the release and run any function to approve it.

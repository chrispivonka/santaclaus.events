# Google Apps Script for booking requests

The site's "Request a private booking" and "Request a photo shoot" buttons open one pop-up form that sends each request to a Google Apps Script web app, the same way the letter to Santa form does. The script emails private event requests to the addresses in `PRIVATE_RECIPIENTS` and photo shoot requests to the addresses in `PHOTO_RECIPIENTS`. Those addresses live only in the script's settings in Google, never in this repository or on the site.

## Set it up (once)

1. Signed in to the Google account that should own it (ideally the one that owns the letter script), open [script.google.com](https://script.google.com) and click **New project**. Name it "Santa bookings".
2. Delete the sample code, paste in everything from `booking.gs`, and click **Save**.
3. Click **Project Settings** (gear icon) → **Script Properties** → **Add script property**:
   - `PRIVATE_RECIPIENTS`: who gets private event requests, separated by commas, for example `hanna@example.com,santa@example.com`.
   - `PHOTO_RECIPIENTS`: who gets photo shoot requests, for example `writteninlightphotoandfilm@gmail.com,hanna@example.com`.
   - `CALENDAR_ID`: Santa's calendar, so the form can grey out times that are already booked. The calendar the site shows is `c_4f204d20a0c44782fb0858fa3014913a9168af1cc6fb80a6222ba7aa8619948c@group.calendar.google.com`. The Google account that owns the script must be able to see it (share it with that account if needed).
   - `PRIVATE_MINUTES` and `PHOTO_MINUTES` (optional): how long a private visit and a photo shoot take, in minutes, so the form knows which start times fit. They default to 60 and 30.
   - `PRIVATE_TEXT_TO` and `PHOTO_TEXT_TO` (optional): phone numbers that also get a short text about each request, separated by commas, in the form `+13075550123`. Texts need a Twilio account; see "Text alerts" below.
   - `SHEET_ID` (optional): to also log requests in a Google Sheet (one tab per kind), create a blank sheet and paste the long ID from its URL (the part between `/d/` and `/edit`).
4. Click **Deploy** → **New deployment** → the gear next to "Select type" → **Web app**:
   - Execute as: **Me**
   - Who has access: **Anyone**
5. Click **Deploy**, allow the permissions Google asks for (sending email as you, reading your calendars, connecting to an outside service for texts, and the sheet if you set one), and copy the **Web app URL**. It looks like `https://script.google.com/macros/s/AKfy.../exec`.
6. Put that URL in the booking form's `action` in `index.html`, replacing the `BOOKING_SCRIPT_ID` placeholder.

## How the calendar check works

When someone picks a date, the form asks the script which times that day are already taken on Santa's calendar and greys them out (only the times go to the browser, never event names or details). Requests for 9:00 AM to 7:00 PM, every half hour, are offered; that range is set in `js/main.js`. If two people grab the same time at once, the second request still arrives, with "[Time already booked]" at the start of the subject. If the script can't be reached, the form offers every time and says the time will be confirmed by phone.

## Text alerts

Each request can also send a short text, for example "New private booking request from Jamie Frost for 2026-12-20 at 18:30. Phone: 307-555-0123. Details are in your email." Google can't send texts by itself, so this uses [Twilio](https://www.twilio.com):

1. Create a Twilio account and buy a local phone number (about $1–2 a month, plus about a cent per text).
2. In Twilio, complete the US texting registration for that number (Messaging → Regulatory Compliance → A2P 10DLC, "Sole Proprietor" or "Low-Volume Standard"). US carriers block texts from unregistered numbers. Approval can take a few days and has a small one-time fee.
3. Add these script properties: `TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN` (from the Twilio console's front page), `TWILIO_FROM` (the Twilio number, like `+13075550199`), and `PRIVATE_TEXT_TO` / `PHOTO_TEXT_TO` (who gets texts).

If any of those are missing, the script skips texting and just sends the email. A text that fails never stops the email.

## Changing who gets requests

Edit `PRIVATE_RECIPIENTS`, `PHOTO_RECIPIENTS`, `PRIVATE_TEXT_TO` or `PHOTO_TEXT_TO` in Script Properties. No redeploy is needed, and the site doesn't change.

## Changing the script

After editing the code, use **Deploy** → **Manage deployments** → edit (pencil) → Version: **New version** → **Deploy**. That keeps the same URL, so the site doesn't change either.

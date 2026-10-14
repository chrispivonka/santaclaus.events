# Google Apps Script for booking requests

The site's "Request a private booking" and "Request a photo shoot" buttons open one pop-up form that sends each request to a Google Apps Script web app, the same way the letter to Santa form does. The script emails private event requests to the addresses in `PRIVATE_RECIPIENTS` and photo shoot requests to the addresses in `PHOTO_RECIPIENTS`. Those addresses live only in the script's settings in Google, never in this repository or on the site.

## Set it up (once)

1. Signed in to the Google account that should own it (ideally the one that owns the letter script), open [script.google.com](https://script.google.com) and click **New project**. Name it "Santa bookings".
2. Delete the sample code, paste in everything from `booking.gs`, and click **Save**.
3. Click **Project Settings** (gear icon) → **Script Properties** → **Add script property**:
   - `PRIVATE_RECIPIENTS`: who gets private event requests, separated by commas, for example `hanna@example.com,santa@example.com`.
   - `PHOTO_RECIPIENTS`: who gets photo shoot requests, for example `writteninlightphotoandfilm@gmail.com,hanna@example.com`.
   - `SHEET_ID` (optional): to also log requests in a Google Sheet (one tab per kind), create a blank sheet and paste the long ID from its URL (the part between `/d/` and `/edit`).
4. Click **Deploy** → **New deployment** → the gear next to "Select type" → **Web app**:
   - Execute as: **Me**
   - Who has access: **Anyone**
5. Click **Deploy**, allow the permissions Google asks for (sending email as you, and the sheet if you set one), and copy the **Web app URL**. It looks like `https://script.google.com/macros/s/AKfy.../exec`.
6. Put that URL in the booking form's `action` in `index.html`, replacing the `BOOKING_SCRIPT_ID` placeholder.

## Changing who gets requests

Edit `PRIVATE_RECIPIENTS` or `PHOTO_RECIPIENTS` in Script Properties. No redeploy is needed, and the site doesn't change.

## Changing the script

After editing the code, use **Deploy** → **Manage deployments** → edit (pencil) → Version: **New version** → **Deploy**. That keeps the same URL, so the site doesn't change either.

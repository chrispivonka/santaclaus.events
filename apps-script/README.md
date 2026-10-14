# Google Apps Script for private booking requests

The site's "Request a private booking" pop-up sends each request to a Google Apps Script web app, the same way the letter to Santa form does. The script emails the request to every address in its `RECIPIENTS` setting. Those addresses live only in the script's settings in Google, never in this repository or on the site.

## Set it up (once)

1. Signed in to the Google account that should own it (ideally the one that owns the letter script), open [script.google.com](https://script.google.com) and click **New project**. Name it "Santa private bookings".
2. Delete the sample code, paste in everything from `private-booking.gs`, and click **Save**.
3. Click **Project Settings** (gear icon) → **Script Properties** → **Add script property**:
   - `RECIPIENTS`: the addresses that should get every request, separated by commas, for example `writteninlightphotoandfilm@gmail.com,someone@example.com,santa@example.com`.
   - `SHEET_ID` (optional): to also log requests in a Google Sheet, create a blank sheet and paste the long ID from its URL (the part between `/d/` and `/edit`).
4. Click **Deploy** → **New deployment** → the gear next to "Select type" → **Web app**:
   - Execute as: **Me**
   - Who has access: **Anyone**
5. Click **Deploy**, allow the permissions Google asks for (sending email as you, and the sheet if you set one), and copy the **Web app URL**. It looks like `https://script.google.com/macros/s/AKfy.../exec`.
6. Put that URL in the booking form's `action` in `index.html`, replacing the `PRIVATE_BOOKING_SCRIPT_ID` placeholder.

## Changing who gets requests

Edit `RECIPIENTS` in Script Properties. No redeploy is needed, and the site doesn't change.

## Changing the script

After editing the code, use **Deploy** → **Manage deployments** → edit (pencil) → Version: **New version** → **Deploy**. That keeps the same URL, so the site doesn't change either.

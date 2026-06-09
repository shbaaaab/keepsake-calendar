# The Calendar

The Calendar is a small installable calendar app for birthdays, anniversaries, notes, photos, and Johannesburg Shabbas times.

The recommended setup is:

```text
GitHub Pages app -> Google Apps Script -> Google Sheet + Gmail
```

That keeps the app free, iPhone-friendly, backed up in Google Sheets, and able to send reliable Gmail messages.

## Files

- `index.html`, `styles.css`, `app.js`: the app
- `config.js`: optional place to paste your Apps Script web-app URL
- `manifest.webmanifest`, `sw.js`, icons: iPhone home-screen/PWA support
- `email-reminders.google-apps-script.js`: Google Sheets + Gmail + Shabbas backend

## Current Features

- Three-panel layout: Next Up, calendar, settings
- Empty calendar days do nothing when tapped
- Event days show the relevant reminders
- Countdown labels in Next Up
- Reminder photos, compressed in the browser before saving
- Google Sheets sync for reminders, settings, and photos
- Chabad Johannesburg Shabbas candle-lighting and Havdalah times
- Test email button in Settings

## 1. Publish The App

You can host this folder with GitHub Pages.

After GitHub Pages is enabled, open the GitHub Pages URL in Safari on your iPhone:

1. Tap Share.
2. Tap Add to Home Screen.
3. Name it The Calendar.

## 2. Create The Google Sheet Backend

1. Go to Google Sheets.
2. Create a blank spreadsheet named `The Calendar`.
3. Open Extensions -> Apps Script.
4. Delete the starter code.
5. Paste the full contents of `email-reminders.google-apps-script.js`.
6. Optional but recommended: set `ACCESS_TOKEN` near the top of the script to a private passcode.
7. Save the Apps Script project.
8. Run `setupCalendarSheets` once.
9. Approve the Google permissions.

The script creates or migrates two tabs:

- `Events`: reminders, notes, repeat frequency, and compressed photo data
- `Settings`: email, reminder time, timezone

## 3. Deploy Apps Script As A Web App

In Apps Script:

1. Click Deploy -> New deployment.
2. Choose Web app.
3. Execute as: Me.
4. Who has access: Anyone.
5. Click Deploy.
6. Copy the Web app URL.

The URL will look like:

```text
https://script.google.com/macros/s/AKfycb.../exec
```

## 4. Connect The App

Option A, easiest:

1. Open The Calendar.
2. Paste the Apps Script URL in Settings.
3. Paste the sync passcode if you set `ACCESS_TOKEN`.
4. Add your Gmail address.
5. Save settings.
6. Tap Send Test Email.

Option B, best before publishing:

1. Open `config.js`.
2. Paste the URL like this:

```js
window.THE_CALENDAR_SCRIPT_URL = "https://script.google.com/macros/s/AKfycb.../exec";
window.THE_CALENDAR_SYNC_TOKEN = "your-private-passcode";
```

3. Commit and push the updated file.

Only put the sync token in `config.js` if the GitHub repository is private. If the repository is public, enter the passcode inside the app settings instead.

## 5. Email

The current email workflow is intentionally simple:

1. Configure the Apps Script URL.
2. Configure the email address.
3. Tap Send Test Email.

Once test emails are reliable, reminder emails can be expanded further.

The older daily reminder function is still available as `sendTodaysCalendarReminders`. To enable it manually, run `createCalendarMorningTrigger` once in Apps Script. Google time triggers run near the selected hour, not always exactly on the minute.

## 6. Shabbas Times

The Calendar fetches Johannesburg candle-lighting and Havdalah times from Chabad.org:

```text
https://www.chabad.org/calendar/candlelighting_cdo/locationId/248/locationType/1/jewish/Candle-Lighting.htm
```

The source label should remain visible as `Chabad.org/ShabbatTimes Johannesburg`.

Apps Script uses `UrlFetchApp` to fetch the Chabad page and `CacheService` to cache the current result for 6 hours. The app also caches the last synced Shabbas times locally so it still has something to display if temporarily offline.

## Notes On Photos

Photos are resized and saved as compressed JPEG data before syncing. This is simple and works without extra storage services, but Google Sheets is not ideal for large photo libraries. Keep photos small and use one photo per reminder.

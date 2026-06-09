# Keepsake Calendar

Keepsake is a small installable calendar app for birthdays, dating anniversaries, engagement anniversaries, wedding anniversaries, and other reminders.

The recommended setup is:

```text
GitHub Pages app -> Google Apps Script -> Google Sheet + Gmail
```

That keeps the app free, iPhone-friendly, backed up in Google Sheets, and able to send reliable morning Gmail reminders.

## Files

- `index.html`, `styles.css`, `app.js`: the app
- `config.js`: optional place to paste your Apps Script web-app URL
- `manifest.webmanifest`, `sw.js`, icons: iPhone home-screen/PWA support
- `email-reminders.google-apps-script.js`: Google Sheets + Gmail backend

## 1. Publish The App

You can host this folder with GitHub Pages.

After GitHub Pages is enabled, open the GitHub Pages URL in Safari on your iPhone:

1. Tap Share.
2. Tap Add to Home Screen.
3. Name it Keepsake.

## 2. Create The Google Sheet Backend

1. Go to Google Sheets.
2. Create a blank spreadsheet named `Keepsake Calendar`.
3. Open Extensions -> Apps Script.
4. Delete the starter code.
5. Paste the full contents of `email-reminders.google-apps-script.js`.
6. Optional but recommended: set `ACCESS_TOKEN` near the top of the script to a private passcode.
7. Save the Apps Script project.
8. Run `setupKeepsakeSheets` once.
9. Approve the Google permissions.

The script creates two tabs:

- `Events`: all reminders
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

You have two options.

Option A, easiest:

1. Open Keepsake.
2. Tap Settings.
3. Paste the Apps Script URL.
4. Paste the sync passcode if you set `ACCESS_TOKEN`.
5. Add your Gmail address.
6. Save settings.

Option B, best before publishing:

1. Open `config.js`.
2. Paste the URL like this:

```js
window.KEEPSAKE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycb.../exec";
window.KEEPSAKE_SYNC_TOKEN = "your-private-passcode";
```

3. Commit and push the updated file.

Only put the sync token in `config.js` if the GitHub repository is private. If the repository is public, enter the passcode inside the app settings instead.

## 5. Turn On 4am Email Reminders

In Apps Script:

1. Run `createKeepsakeMorningTrigger` once.
2. Approve permissions if asked.

The trigger calls `sendTodaysKeepsakeReminders` every day around 4am. Apps Script time triggers are reliable but not exact to the minute, so Google may run it shortly before or after 4am.

## Notes

The app keeps a local cache so it can still open quickly. Google Sheets becomes the real source of truth once the Apps Script URL is configured.

Push notifications can be added later, but Gmail reminders through Apps Script are the simpler and more reliable first version for iPhone.

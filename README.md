# Keepsake Calendar

This is a small installable web app for birthdays and anniversaries.

## Open It

From this folder, run a simple local server:

```sh
python3 -m http.server 5173
```

Then open:

```text
http://localhost:5173
```

## Put It On iPhone Home Screen

An iPhone cannot install a random local HTML file as a proper app by itself. The practical path is:

1. Put this folder online somewhere simple, such as GitHub Pages, Netlify, Vercel, or your own small server.
2. Open that web address in Safari on the iPhone.
3. Tap Share.
4. Tap Add to Home Screen.

Once installed, the app opens full-screen and keeps your reminders in that browser/app storage.

## Email Reminders

A home-screen web app cannot reliably wake itself at 4am and send Gmail by itself. For email reminders, use the included `email-reminders.google-apps-script.js` file in Google Apps Script:

1. Go to `script.google.com`.
2. Create a new project.
3. Paste in the script.
4. Change `recipient` and the `EVENTS` list.
5. Add a time-driven trigger for `sendTodaysKeepsakeReminders`, scheduled around 4am.

That gives you the morning Gmail reminder while this app stays simple and private.

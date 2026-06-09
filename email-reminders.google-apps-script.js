const SHEETS = {
  events: "Events",
  settings: "Settings"
};

const DEFAULT_SETTINGS = {
  email: "",
  reminderTime: "04:00",
  timezone: "Africa/Johannesburg"
};

const ACCESS_TOKEN = "";
const EVENT_HEADERS = ["id", "name", "date", "kind", "repeat", "notes", "updatedAt"];
const SETTING_HEADERS = ["key", "value"];

function doGet(event) {
  try {
    setupKeepsakeSheets();
    requireAccess(event.parameter.token || "");
    const action = event.parameter.action || "load";
    if (action !== "load") throw new Error("Unknown action: " + action);
    return jsonOutput(loadAllData(), event.parameter.callback);
  } catch (error) {
    return jsonOutput({ ok: false, error: error.message }, event.parameter.callback);
  }
}

function doPost(event) {
  try {
    setupKeepsakeSheets();
    const payload = JSON.parse(event.postData.contents || "{}");
    requireAccess(payload.token || "");
    if (payload.action !== "saveAll") throw new Error("Unknown action: " + payload.action);
    saveAllData(payload.events || [], payload.settings || {});
    return jsonOutput({ ok: true, savedAt: new Date().toISOString() });
  } catch (error) {
    return jsonOutput({ ok: false, error: error.message });
  }
}

function setupKeepsakeSheets() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const eventsSheet = getOrCreateSheet(spreadsheet, SHEETS.events);
  const settingsSheet = getOrCreateSheet(spreadsheet, SHEETS.settings);
  ensureHeaders(eventsSheet, EVENT_HEADERS);
  ensureHeaders(settingsSheet, SETTING_HEADERS);

  if (eventsSheet.getLastRow() === 1) {
    const now = new Date().toISOString();
    eventsSheet.getRange(2, 1, 3, EVENT_HEADERS.length).setValues([
      [Utilities.getUuid(), "Dating anniversary", "2026-01-08", "anniversary", "monthly", "Change this date to your real start date.", now],
      [Utilities.getUuid(), "Engagement anniversary", "2026-02-14", "anniversary", "yearly", "", now],
      [Utilities.getUuid(), "Wedding anniversary", "2026-06-08", "anniversary", "yearly", "", now]
    ]);
  }

  const settings = readSettings(settingsSheet);
  if (!settings.reminderTime) writeSetting(settingsSheet, "reminderTime", DEFAULT_SETTINGS.reminderTime);
  if (!settings.timezone) writeSetting(settingsSheet, "timezone", DEFAULT_SETTINGS.timezone);
}

function requireAccess(token) {
  if (!ACCESS_TOKEN) return;
  if (token !== ACCESS_TOKEN) throw new Error("Invalid sync passcode");
}

function loadAllData() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const eventsSheet = spreadsheet.getSheetByName(SHEETS.events);
  const settingsSheet = spreadsheet.getSheetByName(SHEETS.settings);
  return {
    ok: true,
    events: readEvents(eventsSheet),
    settings: Object.assign({}, DEFAULT_SETTINGS, readSettings(settingsSheet))
  };
}

function saveAllData(events, settings) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const eventsSheet = spreadsheet.getSheetByName(SHEETS.events);
  const settingsSheet = spreadsheet.getSheetByName(SHEETS.settings);
  const now = new Date().toISOString();

  eventsSheet.clearContents();
  eventsSheet.getRange(1, 1, 1, EVENT_HEADERS.length).setValues([EVENT_HEADERS]);
  const rows = events
    .filter((event) => event.name && event.date)
    .map((event) => [
      event.id || Utilities.getUuid(),
      event.name,
      event.date,
      event.kind || "anniversary",
      event.repeat || "yearly",
      event.notes || "",
      now
    ]);
  if (rows.length) eventsSheet.getRange(2, 1, rows.length, EVENT_HEADERS.length).setValues(rows);

  Object.keys(DEFAULT_SETTINGS).forEach((key) => {
    writeSetting(settingsSheet, key, settings[key] || DEFAULT_SETTINGS[key]);
  });
}

function sendTodaysKeepsakeReminders() {
  setupKeepsakeSheets();
  const data = loadAllData();
  const settings = Object.assign({}, DEFAULT_SETTINGS, data.settings);
  if (!settings.email) return;

  const today = new Date();
  const due = data.events.filter((event) => isDueToday(event, today));
  if (!due.length) return;

  const todayText = Utilities.formatDate(today, settings.timezone, "d MMMM yyyy");
  const lines = due.map((event) => "- " + labelFor(event, today));
  GmailApp.sendEmail(
    settings.email,
    "Keepsake reminder for " + todayText,
    "Today:\n\n" + lines.join("\n")
  );
}

function createKeepsakeMorningTrigger() {
  ScriptApp.getProjectTriggers()
    .filter((trigger) => trigger.getHandlerFunction() === "sendTodaysKeepsakeReminders")
    .forEach((trigger) => ScriptApp.deleteTrigger(trigger));
  ScriptApp.newTrigger("sendTodaysKeepsakeReminders")
    .timeBased()
    .everyDays(1)
    .atHour(4)
    .create();
}

function readEvents(sheet) {
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return [];
  return values.slice(1)
    .filter((row) => row[0] && row[1] && row[2])
    .map((row) => ({
      id: String(row[0]),
      name: String(row[1]),
      date: normalizeDate(row[2]),
      kind: String(row[3] || "anniversary"),
      repeat: String(row[4] || "yearly"),
      notes: String(row[5] || "")
    }));
}

function readSettings(sheet) {
  const values = sheet.getDataRange().getValues();
  const settings = {};
  values.slice(1).forEach((row) => {
    if (row[0]) settings[String(row[0])] = String(row[1] || "");
  });
  return settings;
}

function writeSetting(sheet, key, value) {
  const values = sheet.getDataRange().getValues();
  for (let index = 1; index < values.length; index += 1) {
    if (values[index][0] === key) {
      sheet.getRange(index + 1, 2).setValue(value);
      return;
    }
  }
  sheet.appendRow([key, value]);
}

function getOrCreateSheet(spreadsheet, name) {
  return spreadsheet.getSheetByName(name) || spreadsheet.insertSheet(name);
}

function ensureHeaders(sheet, headers) {
  const current = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  const needsHeaders = headers.some((header, index) => current[index] !== header);
  if (needsHeaders) sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
}

function jsonOutput(payload, callback) {
  const body = callback
    ? callback + "(" + JSON.stringify(payload) + ");"
    : JSON.stringify(payload);
  const mime = callback ? ContentService.MimeType.JAVASCRIPT : ContentService.MimeType.JSON;
  return ContentService.createTextOutput(body).setMimeType(mime);
}

function normalizeDate(value) {
  if (Object.prototype.toString.call(value) === "[object Date]") {
    return Utilities.formatDate(value, "UTC", "yyyy-MM-dd");
  }
  return String(value).slice(0, 10);
}

function parseDate(value) {
  const parts = normalizeDate(value).split("-").map(Number);
  return new Date(parts[0], parts[1] - 1, parts[2]);
}

function sameDate(a, b) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function isDueToday(event, today) {
  const start = parseDate(event.date);
  const day = Math.min(start.getDate(), daysInMonth(today.getFullYear(), today.getMonth()));
  if (today.getDate() !== day) return false;
  if (event.repeat === "monthly") return today >= start;
  if (event.repeat === "yearly") return today.getMonth() === start.getMonth() && today >= start;
  return sameDate(today, start);
}

function labelFor(event, today) {
  if (event.kind === "birthday") return event.name + " birthday";
  const start = parseDate(event.date);
  const months = (today.getFullYear() - start.getFullYear()) * 12 + today.getMonth() - start.getMonth();
  if (event.repeat === "monthly" && months > 0) {
    if (months < 12) return months + " month " + event.name;
    const years = Math.floor(months / 12);
    const remaining = months % 12;
    return years + " year" + (years === 1 ? "" : "s") + (remaining ? " " + remaining + " month" + (remaining === 1 ? "" : "s") : "") + " " + event.name;
  }
  const years = today.getFullYear() - start.getFullYear();
  return years > 0 ? ordinal(years) + " " + event.name : event.name;
}

function ordinal(value) {
  if (value % 100 >= 11 && value % 100 <= 13) return value + "th";
  if (value % 10 === 1) return value + "st";
  if (value % 10 === 2) return value + "nd";
  if (value % 10 === 3) return value + "rd";
  return value + "th";
}

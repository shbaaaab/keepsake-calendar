const CONFIG = {
  recipient: "youraddress@gmail.com",
  reminderHour: 4,
  timezone: "Africa/Johannesburg"
};

const EVENTS = [
  {
    name: "Dating anniversary",
    date: "2026-01-08",
    kind: "anniversary",
    repeat: "monthly"
  },
  {
    name: "Engagement anniversary",
    date: "2026-02-14",
    kind: "anniversary",
    repeat: "yearly"
  },
  {
    name: "Wedding anniversary",
    date: "2026-06-08",
    kind: "anniversary",
    repeat: "yearly"
  }
];

function sendTodaysKeepsakeReminders() {
  const today = new Date();
  const due = EVENTS.filter((event) => isDueToday(event, today));
  if (!due.length) return;

  const lines = due.map((event) => "- " + labelFor(event, today));
  GmailApp.sendEmail(
    CONFIG.recipient,
    "Keepsake reminder for " + Utilities.formatDate(today, CONFIG.timezone, "d MMMM yyyy"),
    "Today:\n\n" + lines.join("\n")
  );
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

function parseDate(value) {
  const parts = value.split("-").map(Number);
  return new Date(parts[0], parts[1] - 1, parts[2]);
}

function sameDate(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function ordinal(value) {
  if (value % 100 >= 11 && value % 100 <= 13) return value + "th";
  if (value % 10 === 1) return value + "st";
  if (value % 10 === 2) return value + "nd";
  if (value % 10 === 3) return value + "rd";
  return value + "th";
}

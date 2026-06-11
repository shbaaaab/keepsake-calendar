const cacheKey = "the-calendar-cache-v3";
const endpointKey = "the-calendar-script-url-v1";
const tokenKey = "the-calendar-sync-token-v1";

const defaultSettings = {
  email: "",
  reminderTime: "04:00",
  timezone: "Africa/Johannesburg"
};

const state = {
  visibleDate: new Date(),
  events: [],
  settings: { ...defaultSettings },
  shabbat: null,
  sync: {
    endpoint: getConfiguredEndpoint(),
    token: getConfiguredToken(),
    status: "loading",
    message: "Loading reminders"
  }
};

const monthTitle = document.querySelector("#monthTitle");
const calendarGrid = document.querySelector("#calendarGrid");
const agendaList = document.querySelector("#agendaList");
const dayDetail = document.querySelector("#dayDetail");
const syncText = document.querySelector("#syncText");
const shabbatIn = document.querySelector("#shabbatIn");
const shabbatOut = document.querySelector("#shabbatOut");
const shabbatSource = document.querySelector("#shabbatSource");
const settingsResult = document.querySelector("#settingsResult");
const modal = document.querySelector("#modal");
const dayModal = document.querySelector("#dayModal");
const dayModalTitle = document.querySelector("#dayModalTitle");
const dayModalList = document.querySelector("#dayModalList");
const eventForm = document.querySelector("#eventForm");
const eventId = document.querySelector("#eventId");
const eventName = document.querySelector("#eventName");
const eventDate = document.querySelector("#eventDate");
const eventRepeat = document.querySelector("#eventRepeat");
const eventPhoto = document.querySelector("#eventPhoto");
const eventPhotoData = document.querySelector("#eventPhotoData");
const photoPreview = document.querySelector("#photoPreview");
const deleteBtn = document.querySelector("#deleteBtn");
const settingsFields = {
  scriptUrl: document.querySelector("#scriptUrl"),
  syncToken: document.querySelector("#syncToken"),
  email: document.querySelector("#emailAddress"),
  reminderTime: document.querySelector("#reminderTime"),
  timezone: document.querySelector("#timezone")
};

function starterEvents() {
  return [
    {
      id: crypto.randomUUID(),
      name: "Dating anniversary",
      date: "2026-01-08",
      repeat: "monthly",
      notes: "",
      photo: ""
    },
    {
      id: crypto.randomUUID(),
      name: "Engagement anniversary",
      date: "2026-02-14",
      repeat: "yearly",
      notes: "",
      photo: ""
    },
    {
      id: crypto.randomUUID(),
      name: "Wedding anniversary",
      date: "2026-06-08",
      repeat: "yearly",
      notes: "",
      photo: ""
    }
  ];
}

function getConfiguredEndpoint() {
  const saved = localStorage.getItem(endpointKey) || "";
  const bundled = window.THE_CALENDAR_SCRIPT_URL || window.KEEPSAKE_SCRIPT_URL || "";
  return saved.trim() || bundled.trim();
}

function getConfiguredToken() {
  const saved = localStorage.getItem(tokenKey) || "";
  const bundled = window.THE_CALENDAR_SYNC_TOKEN || window.KEEPSAKE_SYNC_TOKEN || "";
  return saved.trim() || bundled.trim();
}

function normalizeEvent(event) {
  return {
    id: event.id || crypto.randomUUID(),
    name: event.name || "",
    date: event.date || isoDate(new Date()),
    repeat: event.repeat || "yearly",
    notes: event.notes || "",
    photo: event.photo || ""
  };
}

function loadCache() {
  const saved = localStorage.getItem(cacheKey);
  if (!saved) return { events: starterEvents(), settings: { ...defaultSettings }, shabbat: null };
  try {
    const parsed = JSON.parse(saved);
    return {
      events: Array.isArray(parsed.events) ? parsed.events.map(normalizeEvent) : starterEvents(),
      settings: { ...defaultSettings, ...(parsed.settings || {}) },
      shabbat: parsed.shabbat || null
    };
  } catch {
    return { events: starterEvents(), settings: { ...defaultSettings }, shabbat: null };
  }
}

function saveCache() {
  localStorage.setItem(cacheKey, JSON.stringify({
    events: state.events,
    settings: state.settings,
    shabbat: state.shabbat
  }));
}

function setSync(status, message) {
  state.sync.status = status;
  state.sync.message = message;
  syncText.textContent = message;
  syncText.dataset.status = status;
}

function setSettingsResult(status, message) {
  settingsResult.textContent = message;
  settingsResult.dataset.status = status;
}

function jsonp(url, timeout = 15000) {
  return new Promise((resolve, reject) => {
    const callback = `calendarCallback_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const script = document.createElement("script");
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("Request timed out"));
    }, timeout);

    function cleanup() {
      clearTimeout(timer);
      script.remove();
      delete window[callback];
    }

    window[callback] = (payload) => {
      cleanup();
      resolve(payload);
    };

    const separator = url.includes("?") ? "&" : "?";
    script.src = `${url}${separator}callback=${encodeURIComponent(callback)}&token=${encodeURIComponent(state.sync.token)}&t=${Date.now()}`;
    script.onerror = () => {
      cleanup();
      reject(new Error("Could not reach Google Apps Script"));
    };
    document.head.append(script);
  });
}

async function loadRemoteData() {
  if (!state.sync.endpoint) {
    setSync("local", "Local only");
    return;
  }

  setSync("loading", "Syncing");
  const payload = await jsonp(`${state.sync.endpoint}?action=load`);
  if (!payload || payload.ok === false) throw new Error(payload?.error || "Sync failed");

  state.events = Array.isArray(payload.events) ? payload.events.map(normalizeEvent) : [];
  state.settings = { ...defaultSettings, ...(payload.settings || {}) };
  state.shabbat = payload.shabbat || state.shabbat;
  saveCache();
  populateSettings();
  setSync("synced", "Synced");
}

async function saveRemoteData() {
  saveCache();
  rerender();
  if (!state.sync.endpoint) {
    setSync("local", "Saved on this device");
    return;
  }

  setSync("saving", "Saving");
  const payload = JSON.stringify({
    action: "saveAll",
    token: state.sync.token,
    events: state.events,
    settings: state.settings
  });
  await fetch(state.sync.endpoint, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: payload
  });
  setSync("synced", "Saved to Google");
}

async function sendTestEmail() {
  captureSettings();
  if (!state.settings.email) {
    setSettingsResult("error", "Add an email address first.");
    return;
  }
  if (!state.sync.endpoint) {
    setSettingsResult("error", "Add the Apps Script URL first.");
    return;
  }
  setSettingsResult("loading", "Sending test email...");
  const payload = await jsonp(`${state.sync.endpoint}?action=testEmail&email=${encodeURIComponent(state.settings.email)}`, 20000);
  if (!payload || payload.ok === false) throw new Error(payload?.error || "Test email failed");
  setSettingsResult("ok", "Test email sent.");
}

function captureSettings() {
  state.sync.endpoint = settingsFields.scriptUrl.value.trim();
  state.sync.token = settingsFields.syncToken.value.trim();
  localStorage.setItem(endpointKey, state.sync.endpoint);
  localStorage.setItem(tokenKey, state.sync.token);
  state.settings.email = settingsFields.email.value.trim();
  state.settings.reminderTime = settingsFields.reminderTime.value;
  state.settings.timezone = settingsFields.timezone.value.trim() || defaultSettings.timezone;
}

function populateSettings() {
  settingsFields.scriptUrl.value = state.sync.endpoint;
  settingsFields.syncToken.value = state.sync.token;
  settingsFields.email.value = state.settings.email;
  settingsFields.reminderTime.value = state.settings.reminderTime;
  settingsFields.timezone.value = state.settings.timezone;
}

function isoDate(date) {
  const copy = new Date(date);
  copy.setMinutes(copy.getMinutes() - copy.getTimezoneOffset());
  return copy.toISOString().slice(0, 10);
}

function parseLocalDate(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function normalizeDateInput(value) {
  const compact = String(value || "").trim().replace(/[/.]/g, "-");
  const match = compact.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!match) return compact;
  return [
    match[1],
    match[2].padStart(2, "0"),
    match[3].padStart(2, "0")
  ].join("-");
}

function dayDiff(a, b) {
  const first = new Date(a.getFullYear(), a.getMonth(), a.getDate());
  const second = new Date(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((second - first) / 86400000);
}

function monthDiff(start, end) {
  return (end.getFullYear() - start.getFullYear()) * 12 + end.getMonth() - start.getMonth();
}

function ordinal(value) {
  const suffixes = ["th", "st", "nd", "rd"];
  const mod = value % 100;
  return `${value}${suffixes[(mod - 20) % 10] || suffixes[mod] || suffixes[0]}`;
}

function eventLabel(event, occurrenceDate) {
  if (event.repeat !== "monthly") {
    const start = parseLocalDate(event.date);
    const years = occurrenceDate.getFullYear() - start.getFullYear();
    return years > 0 && event.repeat === "yearly" ? `${ordinal(years)} ${event.name}` : event.name;
  }

  const start = parseLocalDate(event.date);
  const months = monthDiff(start, occurrenceDate);
  if (months <= 0) return event.name;
  if (months < 12) return `${months} month ${event.name}`;
  const years = Math.floor(months / 12);
  const remaining = months % 12;
  const yearText = `${years} year${years === 1 ? "" : "s"}`;
  return remaining ? `${yearText} ${remaining} month${remaining === 1 ? "" : "s"} ${event.name}` : `${yearText} ${event.name}`;
}

function occurrenceForMonth(event, year, month) {
  const start = parseLocalDate(event.date);
  const day = Math.min(start.getDate(), daysInMonth(year, month));
  const occurrence = new Date(year, month, day);
  if (event.repeat === "once") return occurrence.getFullYear() === start.getFullYear() && occurrence.getMonth() === start.getMonth() ? occurrence : null;
  if (event.repeat === "yearly") return month === start.getMonth() && occurrence >= start ? occurrence : null;
  if (event.repeat === "monthly") return occurrence >= start ? occurrence : null;
  return null;
}

function nextOccurrence(event, fromDate = new Date()) {
  const today = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate());
  for (let offset = 0; offset < 240; offset += 1) {
    const probe = new Date(today.getFullYear(), today.getMonth() + offset, 1);
    const occurrence = occurrenceForMonth(event, probe.getFullYear(), probe.getMonth());
    if (occurrence && occurrence >= today) return occurrence;
  }
  return null;
}

function occurrencesInMonth(year, month) {
  return state.events
    .map((event) => ({ event, date: occurrenceForMonth(event, year, month) }))
    .filter((item) => item.date);
}

function formatDate(date, compact = false) {
  return date.toLocaleDateString(undefined, compact
    ? { weekday: "short", day: "numeric", month: "short" }
    : { weekday: "long", day: "numeric", month: "long" });
}

function countdownText(date) {
  const days = dayDiff(new Date(), date);
  if (days === 0) return "Today";
  if (days === 1) return "1 day";
  return `${days} days`;
}

function renderCalendar() {
  const year = state.visibleDate.getFullYear();
  const month = state.visibleDate.getMonth();
  const first = new Date(year, month, 1);
  const today = new Date();
  const monthEvents = occurrencesInMonth(year, month);
  monthTitle.textContent = first.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  calendarGrid.innerHTML = "";

  const startOffset = first.getDay();
  for (let index = 0; index < 42; index += 1) {
    const date = new Date(year, month, index - startOffset + 1);
    const eventsForDay = monthEvents.filter((item) => sameDay(item.date, date));
    const cell = document.createElement("button");
    cell.className = "day-cell";
    cell.type = "button";
    if (date.getMonth() !== month) cell.classList.add("outside");
    if (sameDay(date, today)) cell.classList.add("today");
    if (eventsForDay.length) {
      cell.classList.add("has-events");
      cell.addEventListener("click", () => openDayPopup(date, eventsForDay));
    }

    const number = document.createElement("span");
    number.className = "day-number";
    number.textContent = String(date.getDate());
    cell.append(number);

    const eventsWrap = document.createElement("div");
    eventsWrap.className = "day-events";
    eventsForDay.slice(0, 3).forEach((item) => {
      const pill = document.createElement("span");
      pill.className = "event-pill";
      pill.textContent = eventLabel(item.event, item.date);
      eventsWrap.append(pill);
    });
    shabbatItemsForDate(date).forEach((item) => {
      const pill = document.createElement("span");
      pill.className = `event-pill shabbat-pill ${item.type === "out" ? "shabbat-out" : "shabbat-in"}`;
      pill.textContent = `${item.label}: ${item.time}`;
      eventsWrap.append(pill);
    });
    cell.append(eventsWrap);
    calendarGrid.append(cell);
  }
}

function shabbatItemsForDate(date) {
  const entries = Array.isArray(state.shabbat?.times) ? state.shabbat.times : [];
  const key = isoDate(date);
  if (entries.length) return entries.filter((item) => item.date === key && item.time);

  const fallback = [];
  const today = new Date();
  const friday = new Date(today);
  friday.setDate(today.getDate() + ((5 - today.getDay() + 7) % 7));
  const shabbas = new Date(friday);
  shabbas.setDate(friday.getDate() + 1);
  if (sameDay(date, friday) && state.shabbat?.in) fallback.push({ type: "in", label: "Shabbas in", time: state.shabbat.in });
  if (sameDay(date, shabbas) && state.shabbat?.out) fallback.push({ type: "out", label: "Shabbas out", time: state.shabbat.out });
  return fallback;
}

function upcomingItems(limit = 50) {
  return state.events
    .map((event) => ({ event, date: nextOccurrence(event) }))
    .filter((item) => item.date)
    .sort((a, b) => a.date - b.date)
    .slice(0, limit);
}

function renderAgenda() {
  const items = upcomingItems(12);
  agendaList.innerHTML = "";
  if (!items.length) {
    agendaList.innerHTML = '<p class="empty">No reminders yet.</p>';
    return;
  }
  items.forEach((item) => agendaList.append(agendaItem(item.event, item.date)));
}

function agendaItem(event, date) {
  const row = document.createElement("article");
  row.className = "agenda-item";

  const visual = event.photo ? document.createElement("img") : document.createElement("div");
  if (event.photo) {
    visual.className = "thumb";
    visual.src = event.photo;
    visual.alt = "";
  } else {
    visual.className = "date-chip";
    visual.textContent = date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  const body = document.createElement("div");
  const title = document.createElement("p");
  title.className = "agenda-title";
  title.textContent = eventLabel(event, date);
  const meta = document.createElement("p");
  meta.className = "agenda-meta";
  meta.textContent = `${formatDate(date, true)} · ${event.repeat[0].toUpperCase()}${event.repeat.slice(1)}`;
  body.append(title, meta);

  const countdown = document.createElement("button");
  countdown.className = "countdown";
  countdown.type = "button";
  countdown.textContent = countdownText(date);
  countdown.title = "Edit reminder";
  countdown.addEventListener("click", () => openEditModal(event.id));

  row.append(visual, body, countdown);
  row.addEventListener("click", (click) => {
    if (click.target === countdown) return;
    openEditModal(event.id);
  });
  return row;
}

function renderDayDetail(date, items) {
  dayDetail.innerHTML = "";
  const label = document.createElement("p");
  label.className = "mini-label";
  label.textContent = formatDate(date);
  const list = document.createElement("div");
  list.className = "detail-list";
  items
    .sort((a, b) => a.event.name.localeCompare(b.event.name))
    .forEach((item) => {
      const row = document.createElement("article");
      row.className = "detail-item";
      const body = document.createElement("div");
      const title = document.createElement("p");
      title.className = "agenda-title";
      title.textContent = eventLabel(item.event, item.date);
      const meta = document.createElement("p");
      meta.className = "agenda-meta";
      meta.textContent = `${item.event.repeat[0].toUpperCase()}${item.event.repeat.slice(1)}`;
      body.append(title, meta);
      const edit = document.createElement("button");
      edit.className = "icon-btn";
      edit.type = "button";
      edit.ariaLabel = "Edit reminder";
      edit.title = "Edit reminder";
      edit.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';
      edit.addEventListener("click", () => openEditModal(item.event.id));
      row.append(body, edit);
      if (item.event.photo) {
        const photo = document.createElement("img");
        photo.className = "thumb";
        photo.src = item.event.photo;
        photo.alt = "";
        row.prepend(photo);
        row.style.gridTemplateColumns = "54px minmax(0, 1fr) 44px";
      }
      list.append(row);
    });
  dayDetail.append(label, list);
  dayDetail.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function openDayPopup(date, items) {
  renderDayDetail(date, items);
  dayModalTitle.textContent = formatDate(date);
  dayModalList.innerHTML = "";
  items
    .sort((a, b) => a.event.name.localeCompare(b.event.name))
    .forEach((item) => {
      const row = document.createElement("article");
      row.className = "day-popup-item";
      if (item.event.photo) {
        const photo = document.createElement("img");
        photo.className = "thumb";
        photo.src = item.event.photo;
        photo.alt = "";
        row.append(photo);
      }
      const body = document.createElement("div");
      const title = document.createElement("p");
      title.className = "agenda-title";
      title.textContent = eventLabel(item.event, item.date);
      const meta = document.createElement("p");
      meta.className = "agenda-meta";
      meta.textContent = `${formatDate(item.date, true)} · ${item.event.repeat[0].toUpperCase()}${item.event.repeat.slice(1)}`;
      body.append(title, meta);
      row.append(body);
      dayModalList.append(row);
    });
  dayModal.showModal();
}

function renderShabbat() {
  if (!state.shabbat) {
    shabbatIn.textContent = "--:--";
    shabbatOut.textContent = "--:--";
    shabbatSource.textContent = "Johannesburg times";
    return;
  }
  shabbatIn.textContent = state.shabbat.in || "--:--";
  shabbatOut.textContent = state.shabbat.out || "--:--";
  shabbatSource.textContent = "Johannesburg times";
}

function openAddModal(date = isoDate(new Date())) {
  eventForm.reset();
  document.querySelector("#modalTitle").textContent = "Add Reminder";
  eventId.value = "";
  eventDate.value = date;
  eventRepeat.value = "yearly";
  eventPhotoData.value = "";
  photoPreview.classList.add("hidden");
  photoPreview.style.backgroundImage = "";
  deleteBtn.classList.add("hidden");
  modal.showModal();
}

function openEditModal(id) {
  const event = state.events.find((item) => item.id === id);
  if (!event) return;
  document.querySelector("#modalTitle").textContent = "Edit Reminder";
  eventId.value = event.id;
  eventName.value = event.name;
  eventDate.value = event.date;
  eventRepeat.value = event.repeat;
  eventPhotoData.value = event.photo || "";
  if (event.photo) {
    photoPreview.style.backgroundImage = `url("${event.photo}")`;
    photoPreview.classList.remove("hidden");
  } else {
    photoPreview.style.backgroundImage = "";
    photoPreview.classList.add("hidden");
  }
  deleteBtn.classList.remove("hidden");
  modal.showModal();
}

function exportData() {
  const payload = JSON.stringify({ events: state.events, settings: state.settings, shabbat: state.shabbat }, null, 2);
  const blob = new Blob([payload], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "the-calendar-backup.json";
  link.click();
  URL.revokeObjectURL(link.href);
}

function resizePhoto(file) {
  return new Promise((resolve, reject) => {
    if (!file) return resolve("");
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read photo"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Could not process photo"));
      img.onload = () => {
        const maxSide = 520;
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const context = canvas.getContext("2d");
        context.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", .58));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function rerender() {
  renderCalendar();
  renderAgenda();
  renderShabbat();
}

document.querySelector("#prevMonth").addEventListener("click", () => {
  state.visibleDate = new Date(state.visibleDate.getFullYear(), state.visibleDate.getMonth() - 1, 1);
  renderCalendar();
});

document.querySelector("#nextMonth").addEventListener("click", () => {
  state.visibleDate = new Date(state.visibleDate.getFullYear(), state.visibleDate.getMonth() + 1, 1);
  renderCalendar();
});

document.querySelector("#todayBtn").addEventListener("click", () => {
  state.visibleDate = new Date();
  rerender();
});

document.querySelector("#openAdd").addEventListener("click", () => openAddModal());

document.querySelector("#saveSettings").addEventListener("click", async () => {
  captureSettings();
  await saveRemoteData()
    .then(() => setSettingsResult("ok", "Settings saved."))
    .catch((error) => {
      setSync("error", error.message);
      setSettingsResult("error", error.message);
    });
});

document.querySelector("#syncNow").addEventListener("click", async () => {
  captureSettings();
  await loadRemoteData()
    .then(() => {
      rerender();
      setSettingsResult("ok", "Synced from Google.");
    })
    .catch((error) => {
      setSync("error", error.message);
      setSettingsResult("error", error.message);
    });
});

document.querySelector("#sendTestEmail").addEventListener("click", async () => {
  await sendTestEmail().catch((error) => setSettingsResult("error", error.message));
});

document.querySelector("#exportData").addEventListener("click", exportData);

eventPhoto.addEventListener("change", async () => {
  const file = eventPhoto.files?.[0];
  if (!file) return;
  try {
    eventPhotoData.value = await resizePhoto(file);
    photoPreview.style.backgroundImage = `url("${eventPhotoData.value}")`;
    photoPreview.classList.remove("hidden");
  } catch (error) {
    setSync("error", error.message);
  }
});

eventDate.addEventListener("blur", () => {
  eventDate.value = normalizeDateInput(eventDate.value);
});

document.querySelector("#closeDayModal").addEventListener("click", () => dayModal.close());

eventForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const payload = normalizeEvent({
    id: eventId.value || crypto.randomUUID(),
    name: eventName.value.trim(),
    date: normalizeDateInput(eventDate.value),
    repeat: eventRepeat.value,
    notes: "",
    photo: eventPhotoData.value
  });
  const index = state.events.findIndex((item) => item.id === payload.id);
  if (index >= 0) state.events[index] = payload;
  else state.events.push(payload);
  modal.close();
  await saveRemoteData().catch((error) => setSync("error", error.message));
});

deleteBtn.addEventListener("click", async () => {
  if (!eventId.value) return;
  state.events = state.events.filter((item) => item.id !== eventId.value);
  modal.close();
  await saveRemoteData().catch((error) => setSync("error", error.message));
});

async function boot() {
  const cached = loadCache();
  state.events = cached.events;
  state.settings = cached.settings;
  state.shabbat = cached.shabbat;
  populateSettings();
  rerender();

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }

  await loadRemoteData()
    .then(rerender)
    .catch((error) => setSync("error", state.sync.endpoint ? error.message : "Local only"));
}

boot();

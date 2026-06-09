const cacheKey = "keepsake-calendar-cache-v2";
const endpointKey = "keepsake-script-url-v1";
const tokenKey = "keepsake-sync-token-v1";

const defaultSettings = {
  email: "",
  reminderTime: "04:00",
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Africa/Johannesburg"
};

const state = {
  visibleDate: new Date(),
  events: [],
  settings: { ...defaultSettings },
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
const syncText = document.querySelector("#syncText");
const modal = document.querySelector("#modal");
const eventForm = document.querySelector("#eventForm");
const eventId = document.querySelector("#eventId");
const eventName = document.querySelector("#eventName");
const eventDate = document.querySelector("#eventDate");
const eventKind = document.querySelector("#eventKind");
const eventRepeat = document.querySelector("#eventRepeat");
const eventNotes = document.querySelector("#eventNotes");
const deleteBtn = document.querySelector("#deleteBtn");

function starterEvents() {
  return [
    {
      id: crypto.randomUUID(),
      name: "Dating anniversary",
      date: "2026-01-08",
      kind: "anniversary",
      repeat: "monthly",
      notes: "Change this date to your real start date."
    },
    {
      id: crypto.randomUUID(),
      name: "Engagement anniversary",
      date: "2026-02-14",
      kind: "anniversary",
      repeat: "yearly",
      notes: ""
    },
    {
      id: crypto.randomUUID(),
      name: "Wedding anniversary",
      date: "2026-06-08",
      kind: "anniversary",
      repeat: "yearly",
      notes: ""
    }
  ];
}

function getConfiguredEndpoint() {
  const saved = localStorage.getItem(endpointKey) || "";
  const bundled = window.KEEPSAKE_SCRIPT_URL || "";
  return saved.trim() || bundled.trim();
}

function getConfiguredToken() {
  const saved = localStorage.getItem(tokenKey) || "";
  const bundled = window.KEEPSAKE_SYNC_TOKEN || "";
  return saved.trim() || bundled.trim();
}

function loadCache() {
  const saved = localStorage.getItem(cacheKey);
  if (!saved) return { events: starterEvents(), settings: { ...defaultSettings } };
  try {
    const parsed = JSON.parse(saved);
    return {
      events: Array.isArray(parsed.events) ? parsed.events : starterEvents(),
      settings: { ...defaultSettings, ...(parsed.settings || {}) }
    };
  } catch {
    return { events: starterEvents(), settings: { ...defaultSettings } };
  }
}

function saveCache() {
  localStorage.setItem(cacheKey, JSON.stringify({ events: state.events, settings: state.settings }));
}

function setSync(status, message) {
  state.sync.status = status;
  state.sync.message = message;
  if (syncText) {
    syncText.textContent = message;
    syncText.dataset.status = status;
  }
}

function jsonp(url, timeout = 12000) {
  return new Promise((resolve, reject) => {
    const callback = `keepsakeCallback_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const script = document.createElement("script");
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("Sync timed out"));
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

  state.events = Array.isArray(payload.events) ? payload.events : [];
  state.settings = { ...defaultSettings, ...(payload.settings || {}) };
  saveCache();
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
  const payload = JSON.stringify({ action: "saveAll", token: state.sync.token, events: state.events, settings: state.settings });
  await fetch(state.sync.endpoint, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: payload
  });
  setSync("synced", "Saved to Google");
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

function monthDiff(start, end) {
  return (end.getFullYear() - start.getFullYear()) * 12 + end.getMonth() - start.getMonth();
}

function ordinal(value) {
  const suffixes = ["th", "st", "nd", "rd"];
  const mod = value % 100;
  return `${value}${suffixes[(mod - 20) % 10] || suffixes[mod] || suffixes[0]}`;
}

function anniversaryLabel(event, occurrenceDate) {
  const start = parseLocalDate(event.date);
  const months = monthDiff(start, occurrenceDate);
  if (months <= 0) return event.name;
  if (event.repeat === "monthly") {
    if (months < 12) return `${months} month ${event.name}`;
    const years = Math.floor(months / 12);
    const remaining = months % 12;
    const yearText = `${years} year${years === 1 ? "" : "s"}`;
    return remaining ? `${yearText} ${remaining} month${remaining === 1 ? "" : "s"} ${event.name}` : `${yearText} ${event.name}`;
  }
  const years = occurrenceDate.getFullYear() - start.getFullYear();
  return years > 0 ? `${ordinal(years)} ${event.name}` : event.name;
}

function eventLabel(event, occurrenceDate) {
  if (event.kind === "birthday") return `${event.name} birthday`;
  if (event.kind === "anniversary") return anniversaryLabel(event, occurrenceDate);
  return event.name;
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
    const cell = document.createElement("button");
    cell.className = "day-cell";
    cell.type = "button";
    if (date.getMonth() !== month) cell.classList.add("outside");
    if (sameDay(date, today)) cell.classList.add("today");
    cell.addEventListener("click", () => openAddModal(isoDate(date)));

    const number = document.createElement("span");
    number.className = "day-number";
    number.textContent = String(date.getDate());
    cell.append(number);

    const eventsWrap = document.createElement("div");
    eventsWrap.className = "day-events";
    monthEvents
      .filter((item) => sameDay(item.date, date))
      .slice(0, 3)
      .forEach((item) => {
        const pill = document.createElement("span");
        pill.className = `event-pill ${item.event.kind}`;
        pill.textContent = eventLabel(item.event, item.date);
        eventsWrap.append(pill);
      });
    cell.append(eventsWrap);
    calendarGrid.append(cell);
  }
}

function renderAgenda() {
  const items = state.events
    .map((event) => ({ event, date: nextOccurrence(event) }))
    .filter((item) => item.date)
    .sort((a, b) => a.date - b.date)
    .slice(0, 8);

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

  const chip = document.createElement("div");
  chip.className = "date-chip";
  chip.textContent = date.toLocaleDateString(undefined, { month: "short", day: "numeric" });

  const body = document.createElement("div");
  const title = document.createElement("p");
  title.className = "agenda-title";
  title.textContent = eventLabel(event, date);
  const meta = document.createElement("p");
  meta.className = "agenda-meta";
  meta.textContent = `${date.toLocaleDateString(undefined, { weekday: "long" })} · ${event.repeat}`;
  body.append(title, meta);

  const edit = document.createElement("button");
  edit.className = "icon-btn";
  edit.type = "button";
  edit.ariaLabel = "Edit reminder";
  edit.title = "Edit reminder";
  edit.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';
  edit.addEventListener("click", () => openEditModal(event.id));

  row.append(chip, body, edit);
  return row;
}

function openAddModal(date = isoDate(new Date())) {
  eventForm.reset();
  document.querySelector("#modalTitle").textContent = "Add Reminder";
  eventId.value = "";
  eventDate.value = date;
  eventKind.value = "anniversary";
  eventRepeat.value = "yearly";
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
  eventKind.value = event.kind;
  eventRepeat.value = event.repeat;
  eventNotes.value = event.notes || "";
  deleteBtn.classList.remove("hidden");
  modal.showModal();
}

function closeOverlay() {
  document.querySelector(".overlay-panel")?.remove();
  document.querySelectorAll(".dock-item").forEach((button) => button.classList.toggle("active", button.dataset.panel === "calendar"));
}

function renderListPanel() {
  closeOverlay();
  const fragment = document.querySelector("#listPanelTemplate").content.cloneNode(true);
  const panel = fragment.querySelector(".overlay-panel");
  const list = fragment.querySelector("#allEvents");
  state.events
    .map((event) => ({ event, date: nextOccurrence(event) }))
    .filter((item) => item.date)
    .sort((a, b) => a.date - b.date)
    .forEach((item) => list.append(agendaItem(item.event, item.date)));
  if (!list.children.length) list.innerHTML = '<p class="empty">No reminders yet.</p>';
  panel.querySelector("[data-close-panel]").addEventListener("click", closeOverlay);
  document.body.append(panel);
}

function renderSettingsPanel() {
  closeOverlay();
  const fragment = document.querySelector("#settingsPanelTemplate").content.cloneNode(true);
  const panel = fragment.querySelector(".overlay-panel");
  panel.querySelector("#scriptUrl").value = state.sync.endpoint;
  panel.querySelector("#syncToken").value = state.sync.token;
  panel.querySelector("#emailAddress").value = state.settings.email;
  panel.querySelector("#reminderTime").value = state.settings.reminderTime;
  panel.querySelector("#timezone").value = state.settings.timezone;

  panel.querySelector("#saveSettings").addEventListener("click", async () => {
    state.sync.endpoint = panel.querySelector("#scriptUrl").value.trim();
    state.sync.token = panel.querySelector("#syncToken").value.trim();
    localStorage.setItem(endpointKey, state.sync.endpoint);
    localStorage.setItem(tokenKey, state.sync.token);
    state.settings.email = panel.querySelector("#emailAddress").value.trim();
    state.settings.reminderTime = panel.querySelector("#reminderTime").value;
    state.settings.timezone = panel.querySelector("#timezone").value.trim() || defaultSettings.timezone;
    await saveRemoteData().catch((error) => setSync("error", error.message));
    closeOverlay();
  });

  panel.querySelector("#syncNow").addEventListener("click", async () => {
    state.sync.endpoint = panel.querySelector("#scriptUrl").value.trim();
    state.sync.token = panel.querySelector("#syncToken").value.trim();
    localStorage.setItem(endpointKey, state.sync.endpoint);
    localStorage.setItem(tokenKey, state.sync.token);
    await loadRemoteData()
      .then(rerender)
      .catch((error) => setSync("error", error.message));
    closeOverlay();
  });

  panel.querySelector("#exportData").addEventListener("click", exportData);
  panel.querySelector("[data-close-panel]").addEventListener("click", closeOverlay);
  document.body.append(panel);
}

function exportData() {
  const payload = JSON.stringify({ events: state.events, settings: state.settings }, null, 2);
  const blob = new Blob([payload], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "keepsake-calendar-backup.json";
  link.click();
  URL.revokeObjectURL(link.href);
}

function rerender() {
  renderCalendar();
  renderAgenda();
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

eventKind.addEventListener("change", () => {
  if (eventKind.value === "birthday") eventRepeat.value = "yearly";
  if (eventKind.value === "anniversary" && eventRepeat.value === "once") eventRepeat.value = "yearly";
});

eventForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const payload = {
    id: eventId.value || crypto.randomUUID(),
    name: eventName.value.trim(),
    date: eventDate.value,
    kind: eventKind.value,
    repeat: eventRepeat.value,
    notes: eventNotes.value.trim()
  };
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

document.querySelectorAll(".dock-item").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".dock-item").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    if (button.dataset.panel === "calendar") closeOverlay();
    if (button.dataset.panel === "list") renderListPanel();
    if (button.dataset.panel === "settings") renderSettingsPanel();
  });
});

async function boot() {
  const cached = loadCache();
  state.events = cached.events;
  state.settings = cached.settings;
  rerender();

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }

  await loadRemoteData()
    .then(rerender)
    .catch((error) => setSync("error", state.sync.endpoint ? error.message : "Local only"));
}

boot();

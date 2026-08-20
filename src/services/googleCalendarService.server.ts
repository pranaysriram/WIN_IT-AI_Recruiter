/**
 * Google Calendar integration (Phase 7).
 *
 * Routed through the Lovable connector gateway, so no Google OAuth handling
 * lives in the app. Used to check interviewer availability (free/busy) and to
 * create the real interview event with a Meet link.
 */

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_calendar/calendar/v3";

export function isGoogleCalendarConfigured(): boolean {
  return Boolean(process.env["LOVABLE_API_KEY"] && process.env["GOOGLE_CALENDAR_API_KEY"]);
}

async function gcal<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const connectionKey = process.env["GOOGLE_CALENDAR_API_KEY"];
  if (!lovableKey || !connectionKey) {
    throw new Error("Google Calendar is not connected for this project.");
  }

  const res = await fetch(`${GATEWAY_URL}${path}`, {
    method: init?.method ?? "GET",
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": connectionKey,
      "Content-Type": "application/json",
    },
    ...(init?.body ? { body: JSON.stringify(init.body) } : {}),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`Google Calendar request failed [${res.status}] ${path}: ${text}`);
    throw new Error(`Google Calendar request failed [${res.status}]: ${text.slice(0, 400)}`);
  }
  return (await res.json()) as T;
}

/* ---------------------------------------------------------------- timezone */

/** Offset (in minutes) of `timeZone` at the given UTC instant. */
function tzOffsetMinutes(instant: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = Object.fromEntries(dtf.formatToParts(instant).map((p) => [p.type, p.value]));
  const asUtc = Date.UTC(
    Number(parts["year"]),
    Number(parts["month"]) - 1,
    Number(parts["day"]),
    Number(parts["hour"] === "24" ? "0" : parts["hour"]),
    Number(parts["minute"]),
    Number(parts["second"]),
  );
  return (asUtc - instant.getTime()) / 60_000;
}

/** Convert a wall-clock date/time in `timeZone` into a real UTC instant. */
export function zonedToUtc(date: string, time: string, timeZone: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const naive = Date.UTC(y!, (m ?? 1) - 1, d!, hh ?? 0, mm ?? 0, 0);
  let guess = new Date(naive);
  for (let i = 0; i < 2; i++) {
    guess = new Date(naive - tzOffsetMinutes(guess, timeZone) * 60_000);
  }
  return guess;
}

/** Format a UTC instant as HH:MM wall-clock in `timeZone`. */
export function utcToZonedTime(instant: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
  }).format(instant);
}

/* ---------------------------------------------------------------- calendars */

export type CalendarSummary = { id: string; summary: string; primary: boolean };

export async function listCalendars(): Promise<CalendarSummary[]> {
  const data = await gcal<{
    items?: Array<{ id: string; summary?: string; primary?: boolean; accessRole?: string }>;
  }>("/users/me/calendarList");
  return (data.items ?? [])
    .filter((c) => c.accessRole === "owner" || c.accessRole === "writer" || c.primary)
    .map((c) => ({ id: c.id, summary: c.summary ?? c.id, primary: Boolean(c.primary) }));
}

/* ---------------------------------------------------------------- freebusy */

export type BusyBlock = { start: string; end: string };

export async function getBusyBlocks(params: {
  calendarIds: string[];
  timeMin: Date;
  timeMax: Date;
  timeZone: string;
}): Promise<BusyBlock[]> {
  const data = await gcal<{
    calendars?: Record<string, { busy?: BusyBlock[]; errors?: Array<{ reason: string }> }>;
  }>("/freeBusy", {
    method: "POST",
    body: {
      timeMin: params.timeMin.toISOString(),
      timeMax: params.timeMax.toISOString(),
      timeZone: params.timeZone,
      items: params.calendarIds.map((id) => ({ id })),
    },
  });

  const blocks: BusyBlock[] = [];
  for (const cal of Object.values(data.calendars ?? {})) {
    for (const b of cal.busy ?? []) blocks.push(b);
  }
  return blocks.sort((a, b) => a.start.localeCompare(b.start));
}

export type Slot = { time: string; startsAt: string; endsAt: string };

/**
 * Candidate-interested → check availability: walk the working day in
 * `stepMinutes` increments and drop anything overlapping a busy block.
 */
export async function findAvailableSlots(params: {
  date: string;
  timeZone: string;
  durationMinutes: number;
  calendarIds: string[];
  dayStart?: string;
  dayEnd?: string;
  stepMinutes?: number;
}): Promise<{ slots: Slot[]; busy: BusyBlock[] }> {
  const dayStart = params.dayStart ?? "09:00";
  const dayEnd = params.dayEnd ?? "18:00";
  const step = params.stepMinutes ?? 30;

  const windowStart = zonedToUtc(params.date, dayStart, params.timeZone);
  const windowEnd = zonedToUtc(params.date, dayEnd, params.timeZone);

  const busy = await getBusyBlocks({
    calendarIds: params.calendarIds,
    timeMin: windowStart,
    timeMax: windowEnd,
    timeZone: params.timeZone,
  });

  const slots: Slot[] = [];
  const now = Date.now();
  for (
    let t = windowStart.getTime();
    t + params.durationMinutes * 60_000 <= windowEnd.getTime();
    t += step * 60_000
  ) {
    const start = t;
    const end = t + params.durationMinutes * 60_000;
    if (start < now) continue;
    const clashes = busy.some((b) => {
      const bs = new Date(b.start).getTime();
      const be = new Date(b.end).getTime();
      return start < be && end > bs;
    });
    if (clashes) continue;
    slots.push({
      time: utcToZonedTime(new Date(start), params.timeZone),
      startsAt: new Date(start).toISOString(),
      endsAt: new Date(end).toISOString(),
    });
  }
  return { slots, busy };
}

/* ------------------------------------------------------------------ events */

export type CreatedEvent = {
  id: string;
  htmlLink: string | null;
  hangoutLink: string | null;
  iCalUID: string | null;
  status: string | null;
};

export async function createInterviewEvent(params: {
  calendarId: string;
  summary: string;
  description: string;
  startsAt: Date;
  endsAt: Date;
  timeZone: string;
  attendeeEmails: string[];
  meetingLink?: string | null;
  addMeet?: boolean;
}): Promise<CreatedEvent> {
  const requestId = crypto.randomUUID();
  const query = new URLSearchParams({ sendUpdates: "all" });
  if (params.addMeet) query.set("conferenceDataVersion", "1");

  const body: Record<string, unknown> = {
    summary: params.summary,
    description: params.description,
    start: { dateTime: params.startsAt.toISOString(), timeZone: params.timeZone },
    end: { dateTime: params.endsAt.toISOString(), timeZone: params.timeZone },
    attendees: params.attendeeEmails.filter(Boolean).map((email) => ({ email })),
    reminders: { useDefault: true },
  };
  if (params.meetingLink) body["location"] = params.meetingLink;
  if (params.addMeet) {
    body["conferenceData"] = {
      createRequest: { requestId, conferenceSolutionKey: { type: "hangoutsMeet" } },
    };
  }

  const event = await gcal<{
    id: string;
    htmlLink?: string;
    hangoutLink?: string;
    iCalUID?: string;
    status?: string;
  }>(`/calendars/${encodeURIComponent(params.calendarId)}/events?${query.toString()}`, {
    method: "POST",
    body,
  });

  return {
    id: event.id,
    htmlLink: event.htmlLink ?? null,
    hangoutLink: event.hangoutLink ?? null,
    iCalUID: event.iCalUID ?? null,
    status: event.status ?? null,
  };
}

export async function cancelInterviewEvent(calendarId: string, eventId: string): Promise<void> {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const connectionKey = process.env["GOOGLE_CALENDAR_API_KEY"];
  if (!lovableKey || !connectionKey) return;
  const res = await fetch(
    `${GATEWAY_URL}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}?sendUpdates=all`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": connectionKey,
      },
    },
  );
  if (!res.ok && res.status !== 404 && res.status !== 410) {
    const text = await res.text();
    console.error(`Google Calendar delete failed [${res.status}]: ${text}`);
    throw new Error(`Could not cancel the calendar event [${res.status}]`);
  }
}

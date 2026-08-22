import type { DB } from "@/db/connection";
import { findAvailableSlots, createInterviewEvent, type CreatedEvent, type Slot, type BusyBlock } from "@/services/googleCalendarService.server";
import { requireOAuthToken } from "@/services/oauthTokenService.server";

export type CalendarEventInput = {
  calendarId: string; summary: string; description: string; startsAt: Date; endsAt: Date;
  timeZone: string; attendeeEmails: string[]; meetingLink?: string | null; addMeet?: boolean;
};
export type AvailabilityInput = { date: string; timeZone: string; durationMinutes: number; calendarIds: string[]; dayStart?: string; dayEnd?: string; stepMinutes?: number };
export interface CalendarProvider {
  createEvent(input: CalendarEventInput): Promise<CreatedEvent>;
  checkAvailability(input: AvailabilityInput): Promise<{ slots: Slot[]; busy: BusyBlock[] }>;
}

function microsoft(db?: DB): CalendarProvider {
  async function request(path: string, init?: RequestInit) {
    if (!db) throw new Error("Database is required for Microsoft Graph");
    const token = await requireOAuthToken(db, "microsoft");
    const response = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
      ...init, headers: { Authorization: `Bearer ${token.accessToken}`, "Content-Type": "application/json", ...(init?.headers ?? {}) },
    });
    if (!response.ok) throw new Error(`Microsoft Graph request failed [${response.status}]: ${(await response.text()).slice(0, 400)}`);
    return response.status === 204 ? null : response.json();
  }
  return {
    async createEvent(input) {
    const event = await this.request(`/me/calendars/${encodeURIComponent(input.calendarId)}/events`, {
      method: "POST", body: JSON.stringify({ subject: input.summary, body: { contentType: "text", content: input.description }, start: { dateTime: input.startsAt.toISOString(), timeZone: input.timeZone }, end: { dateTime: input.endsAt.toISOString(), timeZone: input.timeZone }, location: { displayName: input.meetingLink ?? "Phone / video" }, attendees: input.attendeeEmails.map((address) => ({ emailAddress: { address }, type: "required" })) }),
    }) as { id: string; webLink?: string; iCalUId?: string };
    return { id: event.id, htmlLink: event.webLink ?? null, hangoutLink: null, iCalUID: event.iCalUId ?? null, status: "confirmed" };
    },
    async checkAvailability(input) {
    const start = new Date(`${input.date}T${input.dayStart ?? "09:00"}:00Z`);
    const end = new Date(`${input.date}T${input.dayEnd ?? "18:00"}:00Z`);
    const data = await this.request("/me/calendar/getSchedule", { method: "POST", body: JSON.stringify({ schedules: input.calendarIds.length ? input.calendarIds : ["me"], startTime: { dateTime: start.toISOString(), timeZone: input.timeZone }, endTime: { dateTime: end.toISOString(), timeZone: input.timeZone }, availabilityViewInterval: input.stepMinutes ?? 30 }) }) as { value?: Array<{ scheduleItems?: Array<{ start: { dateTime: string }; end: { dateTime: string } }> }> };
    const busy = (data.value?.flatMap((schedule) => schedule.scheduleItems ?? []) ?? []).map((item) => ({ start: item.start.dateTime, end: item.end.dateTime }));
    const slots: Slot[] = [];
    const step = (input.stepMinutes ?? 30) * 60_000;
    for (let time = start.getTime(); time + input.durationMinutes * 60_000 <= end.getTime(); time += step) {
      const slotEnd = time + input.durationMinutes * 60_000;
      if (time >= Date.now() && !busy.some((block) => time < Date.parse(block.end) && slotEnd > Date.parse(block.start))) slots.push({ time: new Date(time).toLocaleTimeString("en-GB", { timeZone: input.timeZone, hour: "2-digit", minute: "2-digit" }), startsAt: new Date(time).toISOString(), endsAt: new Date(slotEnd).toISOString() });
    }
    return { slots, busy };
    },
  };
}

const google: CalendarProvider = { createEvent: createInterviewEvent, checkAvailability: findAvailableSlots };
export function getCalendarProvider(name: string, db?: DB): CalendarProvider {
  if (name === "microsoft") return microsoft(db);
  return google;
}
export function getCalendarProviderName(name?: string): "google" | "microsoft" { return name === "microsoft" ? "microsoft" : "google"; }
export function getConfiguredCalendarProvider(): "google" | "microsoft" { return getCalendarProviderName(process.env.CALENDAR_PROVIDER); }
export function isMicrosoftCalendarConfigured(): boolean { return Boolean(process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET); }

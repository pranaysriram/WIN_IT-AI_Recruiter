import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/middleware/auth";
import { interviewInput, availabilityInput, uuid } from "@/utils/validation";
import { cancelInterviewById, createInterview } from "@/services/interviewService.server";

/** Is Google Calendar linked, and which calendars can we book into? */
export const getCalendarStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const gcal = await import("@/services/googleCalendarService.server");
    if (!gcal.isGoogleCalendarConfigured()) {
      return { connected: false, calendars: [] as Array<{ id: string; summary: string; primary: boolean }> };
    }
    try {
      const calendars = await gcal.listCalendars();
      return { connected: true, calendars };
    } catch (e) {
      console.error("Calendar status failed", e);
      return { connected: false, calendars: [], error: (e as Error).message };
    }
  });

/** Candidate interested → Google Calendar → check availability. */
export const checkAvailability = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => availabilityInput.parse(data))
  .handler(async ({ data }) => {
    const gcal = await import("@/services/googleCalendarService.server");
    if (!gcal.isGoogleCalendarConfigured()) {
      throw new Error("Google Calendar is not connected for this project.");
    }
    const timeZone = data.timeZone ?? "UTC";
    const calendarIds = data.calendarIds?.length ? data.calendarIds : ["primary"];
    const { slots, busy } = await gcal.findAvailableSlots({
      date: data.date,
      timeZone,
      durationMinutes: data.durationMinutes ?? 45,
      calendarIds,
      ...(data.dayStart ? { dayStart: data.dayStart } : {}),
      ...(data.dayEnd ? { dayEnd: data.dayEnd } : {}),
    });
    return { timeZone, slots, busy };
  });

/** Create interview → send/store the calendar event. */
export const scheduleInterview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => interviewInput.parse(data))
  .handler(async ({ data, context }) => createInterview(context.supabase, data));

/** Cancel an interview and remove the Google Calendar event. */
export const cancelInterview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ scheduleId: uuid, calendarId: z.string().max(200).optional() }).parse(data),
  )
  .handler(async ({ data, context }) =>
    cancelInterviewById(context.supabase, {
      scheduleId: data.scheduleId,
      calendarId: data.calendarId,
    }),
  );

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/middleware/auth";
import { interviewInput, availabilityInput, uuid } from "@/utils/validation";
import { cancelInterviewById, createInterview } from "@/services/interviewService.server";
import { getConfiguredCalendarProvider, getCalendarProvider } from "@/services/calendarProvider.server";

/** Is the configured calendar provider linked? */
export const getCalendarStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const providerName = getConfiguredCalendarProvider();
    if (providerName === "google") {
      const gcal = await import("@/services/googleCalendarService.server");
      if (!gcal.isGoogleCalendarConfigured()) return { connected: false, calendars: [] as Array<{ id: string; summary: string; primary: boolean }> };
      try { return { connected: true, calendars: await gcal.listCalendars() }; } catch (e) { return { connected: false, calendars: [], error: (e as Error).message }; }
    }
    try {
      return { connected: true, calendars: [{ id: "primary", summary: "Microsoft Outlook", primary: true }] };
    } catch (e) {
      console.error("Calendar status failed", e);
      return { connected: false, calendars: [], error: (e as Error).message };
    }
  });

/** Candidate interested → Google Calendar → check availability. */
export const checkAvailability = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => availabilityInput.parse(data))
  .handler(async ({ data, context }) => {
    const provider = getCalendarProvider(getConfiguredCalendarProvider(), context.supabase);
    const timeZone = data.timeZone ?? "UTC";
    const calendarIds = data.calendarIds?.length ? data.calendarIds : ["primary"];
    const { slots, busy } = await provider.checkAvailability({
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

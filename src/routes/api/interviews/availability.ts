import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { preflight, restRoute } from "@/services/restHandler.server";

const querySchema = z.object({
  interviewerEmail: z.string().email().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  duration: z.coerce.number().int().min(15).max(240).optional(),
  timeZone: z.string().max(64).optional(),
});

export const Route = createFileRoute("/api/interviews/availability")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) => preflight(request),

      GET: async ({ request }) =>
        restRoute(request, "interviews-availability", async ({ supabase }) => {
          const params = Object.fromEntries(new URL(request.url).searchParams.entries());
          const input = querySchema.parse(params);

          const { getCalendarProvider, getConfiguredCalendarProvider } = await import("@/services/calendarProvider.server");

          const date = input.date ?? new Date().toISOString().slice(0, 10);
          const durationMinutes = input.duration ?? 45;
          const timeZone = input.timeZone ?? "UTC";
          const calendarIds = input.interviewerEmail ? ["primary"] : ["primary"];

          const { slots, busy } = await getCalendarProvider(getConfiguredCalendarProvider(), supabase).checkAvailability({
            date,
            timeZone,
            durationMinutes,
            calendarIds,
          });

          return Response.json({
            date,
            timeZone,
            durationMinutes,
            slots,
            busy,
          });
        }),
    },
  },
});

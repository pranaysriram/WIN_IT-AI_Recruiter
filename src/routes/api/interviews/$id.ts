import { createFileRoute } from "@tanstack/react-router";
import {
  auditRest,
  HttpError,
  preflight,
  readJson,
  restRoute,
} from "@/services/restHandler.server";
import { getInterview, updateInterview } from "@/services/restResourceService.server";
import { cancelInterviewById } from "@/services/interviewService.server";
import { interviewUpdate, uuid } from "@/utils/validation";

function scheduleId(raw: string): string {
  const parsed = uuid.safeParse(raw);
  if (!parsed.success) throw new HttpError(400, "Invalid interview id");
  return parsed.data;
}

export const Route = createFileRoute("/api/interviews/$id")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) => preflight(request),

      GET: async ({ request, params }) =>
        restRoute(request, "interviews-read", async ({ supabase }) =>
          Response.json(await getInterview(supabase, scheduleId(params.id))),
        ),

      PUT: async ({ request, params }) =>
        restRoute(request, "interviews-write", async ({ supabase }) => {
          const id = scheduleId(params.id);
          const input = await readJson(request, (v) => interviewUpdate.parse(v));
          const interview = await updateInterview(supabase, id, input);
          await auditRest(request, {
            action: "interview.update",
            resourceType: "interview",
            resourceId: id,
            details: { fields: Object.keys(input) },
          });
          return Response.json(interview);
        }, { roles: ["admin", "recruiter"] }),

      // Cancellation reuses the shared service so the calendar event is
      // removed exactly as it is from the dashboard.
      DELETE: async ({ request, params }) =>
        restRoute(request, "interviews-write", async ({ supabase }) => {
          const id = scheduleId(params.id);
          const result = await cancelInterviewById(supabase, { scheduleId: id });
          await auditRest(request, {
            action: "interview.cancel",
            resourceType: "interview",
            resourceId: id,
          });
          return Response.json(result);
        }, { roles: ["admin", "recruiter"] }),
    },
  },
});

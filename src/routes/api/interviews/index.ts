import { createFileRoute } from "@tanstack/react-router";
import { auditRest, preflight, readJson, restRoute } from "@/services/restHandler.server";
import { listInterviews, parseListQuery } from "@/services/restResourceService.server";
import { createInterview } from "@/services/interviewService.server";
import { interviewInput } from "@/utils/validation";

export const Route = createFileRoute("/api/interviews/")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) => preflight(request),

      GET: async ({ request }) =>
        restRoute(request, "interviews-list", async ({ supabase }) =>
          Response.json(await listInterviews(supabase, parseListQuery(request))),
        ),

      // Reuses the same scheduling service the dashboard uses (calendar
      // conflict check, Google event creation, ICS fallback).
      POST: async ({ request }) =>
        restRoute(request, "interviews-write", async ({ supabase }) => {
          const input = await readJson(request, (v) => interviewInput.parse(v));
          const result = await createInterview(supabase, input);
          await auditRest(request, {
            action: "interview.create",
            resourceType: "interview",
            resourceId: result.schedule_id,
            details: { provider: result.provider },
          });
          return Response.json(result, { status: 201 });
        }, { roles: ["admin", "recruiter"] }),
    },
  },
});

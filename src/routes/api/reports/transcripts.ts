import { createFileRoute } from "@tanstack/react-router";
import { preflight, restRoute } from "@/services/restHandler.server";
import { getTranscriptReport, parseListQuery } from "@/services/restResourceService.server";

export const Route = createFileRoute("/api/reports/transcripts")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) => preflight(request),

      GET: async ({ request }) =>
        restRoute(request, "reports-transcripts", async ({ supabase }) =>
          Response.json(await getTranscriptReport(supabase, parseListQuery(request))),
        ),
    },
  },
});

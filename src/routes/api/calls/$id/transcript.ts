import { createFileRoute } from "@tanstack/react-router";
import { HttpError, preflight, restRoute } from "@/services/restHandler.server";
import { getCallTranscript } from "@/services/restResourceService.server";
import { uuid } from "@/utils/validation";

export const Route = createFileRoute("/api/calls/$id/transcript")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) => preflight(request),

      GET: async ({ request, params }) =>
        restRoute(request, "calls-transcript", async ({ supabase }) => {
          const parsed = uuid.safeParse(params.id);
          if (!parsed.success) throw new HttpError(400, "Invalid call id");
          return Response.json(await getCallTranscript(supabase, parsed.data));
        }),
    },
  },
});

import { createFileRoute } from "@tanstack/react-router";
import { preflight, restRoute } from "@/services/restHandler.server";
import { getAnalytics } from "@/services/restResourceService.server";

export const Route = createFileRoute("/api/analytics/")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) => preflight(request),

      GET: async ({ request }) =>
        restRoute(request, "analytics", async ({ supabase }) =>
          Response.json(await getAnalytics(supabase)),
        ),
    },
  },
});
